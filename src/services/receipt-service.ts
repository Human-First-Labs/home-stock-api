import { PrismaClient, ReceiptLines } from "@prisma/client"
import { IVeryfiService } from "./veryfi-service"
import { VeryfiDocument } from "@veryfi/veryfi-sdk/lib/types/VeryfiDocument"

export type IReceiptService = ReturnType<typeof ReceiptService>

interface ReceiptLineConfirmation {
    existingReceiptLine?: ReceiptLines
    newReceiptLine?: {
        title?: string
        sku?: string
        upc?: string
        hsn?: string
        reference?: string
    }
    quantity?: number
}

interface ConfirmedReceiptLine extends ReceiptLineConfirmation {
    newReceiptLine?: {
        title: string
        itemId?: string
    } & ReceiptLineConfirmation['newReceiptLine']
    quantity: number

}

export const ReceiptService = (args: { prisma: PrismaClient, veryfiService: IVeryfiService }) => {
    const { prisma, veryfiService } = args

    const parseReceiptLines = async (args: { document: VeryfiDocument }) => {

        const { document } = args

        const confirmations: ReceiptLineConfirmation[] = []

        if (!document.line_items) {
            throw new Error('No line items found')
        }

        for (const line of document.line_items) {
            const infoObject: {
                description?: string
                sku?: string
                upc?: string
                hsn?: string
                reference?: string
            } = {}

            if (line.description && typeof line.description === 'string') {
                infoObject.description = line.description
            }

            if (line.sku && typeof line.sku === 'string') {
                infoObject.sku = line.sku
            }

            if (line.upc && typeof line.upc === 'string') {
                infoObject.upc = line.upc
            }

            if (line.hsn && typeof line.hsn === 'string') {
                infoObject.hsn = line.hsn
            }

            if (line.reference && typeof line.reference === 'string') {
                infoObject.reference = line.reference
            }

            const quantity = line.quantity && typeof line.quantity === 'number' ? line.quantity : undefined

            const infoKeys: (keyof typeof infoObject)[] = Object.keys(infoObject) as (keyof typeof infoObject)[]
            let existingReceiptLine: ReceiptLines | null = null

            if (infoKeys.length > 0) {
                existingReceiptLine = await prisma.receiptLines.findFirst({
                    where: {
                        OR: infoKeys.map(key => {
                            return { [key]: infoObject[key] }
                        })
                    }
                })
            }


            if (existingReceiptLine) {
                confirmations.push({
                    existingReceiptLine,
                    quantity
                })
            } else {
                confirmations.push({
                    newReceiptLine: infoObject,
                    quantity
                })
            }
        }

        return confirmations

    }

    const uploadReceipt = async (args: { ownerId: string, base64: string; extension: string }) => {
        const { base64, ownerId, extension } = args

        const detectedResponse = await veryfiService.processReceipt({
            ownerId,
            base64,
            extension
        })

        if (!detectedResponse) {
            throw new Error('No response from Veryfi')
        }

        return {
            scan: detectedResponse.scanEntity
        }
    }

    const toggleCancelled = async (args: { ownerId: string, receiptScanId: string }) => {
        const { receiptScanId, ownerId } = args

        const scan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!scan) {
            throw new Error('Scan not found')
        }

        const updatedScan = await prisma.receiptScans.update({
            where: {
                id: receiptScanId
            },
            data: {
                status: scan.status === 'CANCELLED' ? 'PENDING' : 'CANCELLED'
            }
        })

        return {
            scan: updatedScan
        }
    }

    const deleteReceiptScan = async (args: { receiptScanId: string, ownerId: string, }) => {
        const { receiptScanId, ownerId } = args

        const scan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!scan) {
            throw new Error('Scan not found')
        }

        await prisma.itemQuantities.updateMany({
            where: {
                receiptScanId: scan.id
            },
            data: {
                receiptScanId: null
            }
        })

        await prisma.receiptScans.delete({
            where: {
                id: receiptScanId
            }
        })
    }

    const deleteAllUserReceiptScans = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const scans = await prisma.receiptScans.findMany({
            where: {
                ownerId
            }
        })

        await Promise.all(scans.map(scan => {
            return deleteReceiptScan({
                ownerId,
                receiptScanId: scan.id
            })
        }))
    }

    const completeReceiptScan = async (args: { receiptScanId: string, confirmedLines: ConfirmedReceiptLine[], ownerId: string }) => {
        const { receiptScanId, confirmedLines, ownerId } = args

        const scan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!scan) {
            throw new Error('Scan not found')
        }

        if (scan.status !== 'PENDING') {
            throw new Error('Scan not in pending status')
        }

        //validate every confirmation
        for (let i = 0; i < confirmedLines.length; i++) {
            const line = confirmedLines[i]

            if (line.existingReceiptLine) {
                const existing = await prisma.receiptLines.findUnique({
                    where: {
                        id: line.existingReceiptLine.id
                    }
                })

                if (!existing) {
                    throw new Error('Existant Receipt Line not found')
                }
            } else if (line.newReceiptLine) {
                if (!line.quantity) {
                    throw new Error('Quantity not provided')
                }

                if (!line.newReceiptLine) {
                    throw new Error('New Receipt Line not provided')
                }

                if (!line.newReceiptLine.title) {
                    throw new Error('Title not provided')
                }
            } else {
                throw new Error('Invalid line')
            }
        }

        //actually update and create lines
        for (let i = 0; i < confirmedLines.length; i++) {
            const line = confirmedLines[i]

            if (line.existingReceiptLine) {
                const item = await prisma.items.findUnique({
                    where: {
                        id: line.existingReceiptLine.itemId
                    }
                })

                if (!item) {
                    throw new Error('Item not found')
                }

                await prisma.itemQuantities.create({
                    data: {
                        itemId: item.id,
                        quantity: line.quantity
                    }
                })
            } else if (line.newReceiptLine) {
                let itemId = line.newReceiptLine?.itemId
                if (!itemId) {
                    const newItem = await prisma.items.create({
                        data: {
                            title: line.newReceiptLine.title,
                            ownerId,
                        }
                    })

                    itemId = newItem.id
                }

                await prisma.receiptLines.create({
                    data: {
                        ...line.newReceiptLine,
                        itemId,
                    }
                })
            } else {
                throw new Error('Invalid line')
            }
        }

        await prisma.receiptScans.update({
            where: {
                id: receiptScanId
            },
            data: {
                status: 'COMPLETED'
            }
        })
    }

    const getReceiptScans = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const scans = await prisma.receiptScans.findMany({
            where: {
                ownerId
            }
        })

        return {
            scans
        }
    }

    const continueReceiptScan = async (args: { receiptScanId: string, ownerId: string }) => {
        const { receiptScanId, ownerId } = args

        const scan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!scan) {
            throw new Error('Scan not found')
        }

        if (scan.status !== 'PENDING') {
            throw new Error('Scan not in pending status')
        }

        const parsedResponse = await parseReceiptLines({
            document: JSON.parse(scan.rawData)
        })

        return {
            scan,
            lines: parsedResponse
        }
    }

    return {
        uploadReceipt,
        getReceiptScans,
        toggleCancelled,
        continueReceiptScan,
        deleteReceiptScan,
        deleteAllUserReceiptScans,
        completeReceiptScan
    }
}
import { ActionableLineInfo, Items, PrismaClient, ReceiptLineType } from "@prisma/client"
import { IVeryfiService } from "./veryfi-service"
import { VeryfiDocument } from "@veryfi/veryfi-sdk/lib/types/VeryfiDocument"

export type IReceiptService = ReturnType<typeof ReceiptService>

export interface ActionedInfoLine {
    differentItemId?: string
    newItem?: Partial<Items>
    ignore?: boolean
}

export const ReceiptService = (args: { prisma: PrismaClient, veryfiService: IVeryfiService }) => {
    const { prisma, veryfiService } = args

    const extractReceiptLines = async (args: { document: VeryfiDocument }) => {

        const { document } = args

        const lines: ReceiptLineType[] = []

        if (!document.line_items) {
            throw new Error('No line items found')
        }

        for (const line of document.line_items) {
            const infoObject: Partial<ReceiptLineType> = {}

            if (line.description && typeof line.description === 'string') {
                infoObject.title = line.description
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

            infoObject.quantity = line.quantity && typeof line.quantity === 'number' ? line.quantity : undefined

            infoObject.actionableInfo = await generateActionableLine({
                line: infoObject as ReceiptLineType
            })

            lines.push(infoObject as ReceiptLineType)
        }

        return lines

    }

    const generateActionableLine = async (args: {
        line: ReceiptLineType,
    }): Promise<ActionableLineInfo> => {
        const { line } = args

        // Check if the line already exists in the database
        const existingLine = await prisma.learnedReceiptLines.findFirst({
            where: {
                title: line.title,
                sku: line.sku,
                upc: line.upc,
                hsn: line.hsn,
                reference: line.reference
            },
            include: {
                item: true
            }
        })

        if (existingLine) {
            return {
                existingItemId: existingLine.item?.id || null,
                ignore: existingLine.ignore,
                quantityChange: line.quantity,
                title: line.title,
            }
        }

        return {
            existingItemId: null,
            ignore: null,
            quantityChange: line.quantity,
            title: line.title,
        }

    }

    const uploadReceipt = async (args: { ownerId: string, base64: string; extension: string }) => {
        const { base64, ownerId, extension } = args

        const { rawResponse, path } = await veryfiService.processReceipt({
            ownerId,
            base64,
            extension
        })

        if (!rawResponse) {
            throw new Error('No response from Veryfi')
        }

        const savedScan = await prisma.receiptScans.create({
            data: {
                ownerId,
                imagePath: path,
                rawData: JSON.stringify(rawResponse),
                lines: await extractReceiptLines({
                    document: rawResponse,
                })
            }
        })

        return {
            scan: savedScan
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

        await prisma.receiptScans.delete({
            where: {
                id: scan.id
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

    const getCurrentScan = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const scans = await prisma.receiptScans.findMany({
            where: {
                ownerId,
                status: 'PENDING'
            }
        })

        if (scans.length === 0) {
            return {
                status: 'NO_PENDING_SCANS',
            }
        }

        const scan = scans[0]

        const pendingLines = scan.lines.filter(line => line.status === 'PENDING')

        return {
            id: scan.id,
            lines: pendingLines
        }

    }

    const cancelReceiptScan = async (args: { ownerId: string, receiptScanId: string }) => {
        const { ownerId, receiptScanId } = args

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
                status: 'CANCELLED'
            }
        })

        return {
            scan: updatedScan
        }
    }

    const confirmReceiptScan = async (args: {
        ownerId: string,
        receiptScanId: string,
    }) => {
        const { ownerId, receiptScanId } = args

        const scan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!scan) {
            throw new Error('Scan not found')
        }

        const unconfirmedLines: ReceiptLineType[] = []
        const updatedLines: ReceiptLineType[] = []

        for (let i = 0; i < scan.lines.length; i++) {
            const line = scan.lines[i]

            try {
                await confirmReceiptLine({
                    ownerId,
                    receiptScanId,
                    line,
                    actionedInfo: null
                })
                updatedLines.push({
                    ...line,
                    status: 'COMPLETED'
                })
            } catch (e) {
                unconfirmedLines.push(line)
            }
        }

        await prisma.receiptScans.update({
            where: {
                id: scan.id
            },
            data: {
                lines: updatedLines,
                status: unconfirmedLines.length === 0 ? 'COMPLETED' : 'PENDING'
            }
        })

        return {
            lines: unconfirmedLines
        }
    }

    const confirmReceiptLine = async (args: {
        ownerId: string,
        receiptScanId: string,
        line: ReceiptLineType,
        actionedInfo: ActionedInfoLine | null
    }) => {
        const { line, actionedInfo, receiptScanId, ownerId } = args

        const scan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!scan) {
            throw new Error('Scan not found')
        }

        const pendingLines = scan.lines.filter(line => line.status === 'PENDING')

        if (pendingLines.length === 0) {
            throw new Error('No pending lines to confirm')
        }

        const currentActionableLine = pendingLines.find(l => l.title === line.title && l.sku === line.sku && l.upc === line.upc && l.hsn === line.hsn && l.reference === line.reference)

        if (!currentActionableLine) {
            throw new Error('Line not found in pending lines')
        }

        const existingLearnedLine = await prisma.learnedReceiptLines.findFirst({
            where: {
                title: currentActionableLine.title,
                sku: currentActionableLine.sku,
                upc: currentActionableLine.upc,
                hsn: currentActionableLine.hsn,
                reference: currentActionableLine.reference
            },
        })

        if (actionedInfo?.differentItemId) {
            const currentItem = await prisma.items.findUnique({
                where: {
                    id: actionedInfo.differentItemId
                }
            })

            if (!currentItem) {
                throw new Error('Item not found for different item confirmation')
            }

            const updatedQuantity = currentItem.quantity + currentActionableLine.quantity

            await prisma.items.update({
                where: {
                    id: actionedInfo.differentItemId
                },
                data: {
                    quantity: updatedQuantity
                }
            })


            if (existingLearnedLine && existingLearnedLine?.itemId !== actionedInfo.differentItemId) {
                await prisma.learnedReceiptLines.update({
                    where: {
                        id: existingLearnedLine.id
                    },
                    data: {
                        itemId: actionedInfo.differentItemId,
                        ignore: false,
                    }
                })
            } else {
                await prisma.learnedReceiptLines.create({
                    data: {
                        title: currentActionableLine.title,
                        sku: currentActionableLine.sku,
                        upc: currentActionableLine.upc,
                        hsn: currentActionableLine.hsn,
                        reference: currentActionableLine.reference,
                        itemId: actionedInfo.differentItemId,
                        ignore: false,
                    }
                })
            }

        } else if (actionedInfo?.newItem) {

            const newItem = await prisma.items.create({
                data: {
                    ownerId,
                    title: actionedInfo.newItem.title || '',
                    warningAmount: actionedInfo.newItem.warningAmount,
                    quantity: currentActionableLine.quantity,
                }
            })

            if (existingLearnedLine && existingLearnedLine?.itemId !== newItem.id) {
                await prisma.learnedReceiptLines.update({
                    where: {
                        id: existingLearnedLine.id
                    },
                    data: {
                        itemId: newItem.id,
                        ignore: false,
                    }
                })
            } else {
                await prisma.learnedReceiptLines.create({
                    data: {
                        title: currentActionableLine.title,
                        sku: currentActionableLine.sku,
                        upc: currentActionableLine.upc,
                        hsn: currentActionableLine.hsn,
                        reference: currentActionableLine.reference,
                        itemId: newItem.id,
                        ignore: false,
                    }
                })
            }
        } else if (actionedInfo?.ignore) {
            if (existingLearnedLine && !existingLearnedLine?.ignore) {
                await prisma.learnedReceiptLines.update({
                    where: {
                        id: existingLearnedLine.id
                    },
                    data: {
                        itemId: null,
                        ignore: true,
                    }
                })
            } else {
                await prisma.learnedReceiptLines.create({
                    data: {
                        title: currentActionableLine.title,
                        sku: currentActionableLine.sku,
                        upc: currentActionableLine.upc,
                        hsn: currentActionableLine.hsn,
                        reference: currentActionableLine.reference,
                        ignore: true,
                    }
                })
            }
            console.info('Line Ignored')
        } else if (currentActionableLine.actionableInfo.ignore) {
            console.info('Line Ignored')
        } else if (currentActionableLine.actionableInfo.existingItemId) {

            const currentItem = await prisma.items.findUnique({
                where: {
                    id: currentActionableLine.actionableInfo.existingItemId
                }
            })

            if (!currentItem) {
                throw new Error('Item not found for different item confirmation')
            }

            const updatedQuantity = currentItem.quantity + currentActionableLine.quantity

            await prisma.items.update({
                where: {
                    id: currentActionableLine.actionableInfo.existingItemId
                },
                data: {
                    quantity: updatedQuantity
                }
            })
        } else {
            throw new Error('No actionable information provided for line confirmation')
        }

        const updatedLines: ReceiptLineType[] = scan.lines.map(l => {
            if (l.title === line.title && l.sku === line.sku && l.upc === line.upc && l.hsn === line.hsn && l.reference === line.reference) {
                return {
                    ...l,
                    status: 'COMPLETED',
                }
            } else {
                return l
            }
        })

        const unconfirmedLines = updatedLines.filter(l => l.status === 'PENDING')

        await prisma.receiptScans.update({
            where: {
                id: scan.id
            },
            data: {
                lines: updatedLines,
                status: unconfirmedLines.length === 0 ? 'COMPLETED' : 'PENDING'
            }
        })
    }



    return {
        uploadReceipt,
        deleteReceiptScan,
        deleteAllUserReceiptScans,
        getCurrentScan,
        confirmReceiptScan,
        confirmReceiptLine,
        cancelReceiptScan
    }
}
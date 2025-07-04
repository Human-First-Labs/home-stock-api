import { ActionableLineInfo, PrismaClient, ReceiptLineType } from "@prisma/client"
import { IVeryfiService } from "./veryfi-service"
import { VeryfiDocument } from "@veryfi/veryfi-sdk/lib/types/VeryfiDocument"
import crypto from 'crypto'

export type IReceiptService = ReturnType<typeof ReceiptService>

export interface ActionedInfoLine {
    itemId?: string
    quantityMultiplier: number
    quantityChange: number
    ignore?: boolean
}

export const ReceiptService = (args: { prisma: PrismaClient, veryfiService: IVeryfiService }) => {
    const { prisma, veryfiService } = args

    const migrateLearnedLines1 = async () => {
        const learnedLines = await prisma.learnedReceiptLines.findMany({
        })


        const filteredLines = learnedLines.filter(line => {
            return !line.quantityMultiplier || line.quantityMultiplier === 1
        })

        const ids = filteredLines.map(line => line.id)


        await prisma.learnedReceiptLines.updateMany({
            where: {
                id: {
                    in: ids
                }
            },
            data: {
                quantityMultiplier: 1
            }
        })
    }

    const generateLearnedLineId = (args: ReceiptLineType) => {
        const { title, sku, upc, hsn, reference } = args
        let data = `${title}|${sku}|${upc}|${hsn}|${reference}`
        return crypto.createHash('md5').update(data).digest("hex");
    }

    const extractReceiptLines = async (args: { document: VeryfiDocument }) => {

        const { document } = args

        const lines: (ReceiptLineType & { id: string })[] = []

        if (!document.line_items) {
            throw new Error('No line items found')
        }


        for (const line of document.line_items) {
            const infoObject: Partial<(ReceiptLineType & { id: string })> = {}

            if (line.description && typeof line.description === 'string') {
                infoObject.title = line.description
            } else {
                throw new Error('Line item description is required')
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

            const lineId = generateLearnedLineId(infoObject as ReceiptLineType)

            const existentLine = lines.find(l => l.id === lineId)
            if (existentLine) {
                // If the line already exists, we can just update the quantity
                existentLine.quantity += infoObject.quantity || 1

                if (existentLine.actionableInfo.quantityChange) {
                    existentLine.actionableInfo.quantityChange += infoObject.quantity || 1
                }
            } else {
                infoObject.id = lineId

                infoObject.actionableInfo = await generateActionableLine({
                    line: infoObject as ReceiptLineType
                })

                lines.push(infoObject as (ReceiptLineType & { id: string }))

            }

        }

        return lines.map(line => ({
            ...line,
            id: undefined
        })) as ReceiptLineType[]

    }

    const generateActionableLine = async (args: {
        line: ReceiptLineType,
    }): Promise<ActionableLineInfo> => {
        const { line } = args

        const id = generateLearnedLineId(line)

        // Check if the line already exists in the database
        const existingLine = await prisma.learnedReceiptLines.findFirst({
            where: {
                id
            },
            include: {
                item: true
            }
        })

        if (existingLine) {
            return {
                existingItemId: existingLine.item?.id || null,
                ignore: existingLine.ignore,
                quantityChange: line.quantity * existingLine.quantityMultiplier,
                quantityMultiplier: existingLine.quantityMultiplier,
                existingItemTitle: existingLine.title,
            }
        }

        return {
            existingItemId: null,
            ignore: null,
            quantityChange: line.quantity,
            existingItemTitle: null,
            quantityMultiplier: 1
        }

    }

    const parseReceiptReponse = async (args: { response: VeryfiDocument }) => {
        const { response } = args

        if (!response || !response.line_items) {
            throw new Error('Invalid response from Veryfi')
        }


        return {
            rawData: JSON.stringify(response),
            lines: await extractReceiptLines({
                document: response,
            })
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

        const parsedResponse = await parseReceiptReponse({
            response: rawResponse,
        })

        const savedScan = await prisma.receiptScans.create({
            data: {
                ownerId,
                imagePath: path,
                lines: parsedResponse.lines
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
            return
        }

        const scan = scans[0]

        return {
            id: scan.id,
            lines: scan.lines
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

        // const unconfirmedLines: ReceiptLineType[] = []
        // const updatedLines: ReceiptLineType[] = []

        for (let i = 0; i < scan.lines.length; i++) {
            const line = scan.lines[i]

            try {
                await confirmReceiptLine({
                    ownerId,
                    receiptScanId,
                    line,
                    actionedInfo: null
                })
                // updatedLines.push({
                //     ...line,
                //     status: 'COMPLETED'
                // })
            } catch (e) {
                // unconfirmedLines.push(line)
            }
        }

        const updatedScan = await prisma.receiptScans.findUnique({
            where: {
                id: receiptScanId,
                ownerId
            }
        })

        if (!updatedScan) {
            throw new Error('Scan not found after confirmation')
        }

        const unconfirmedLines = updatedScan.lines.filter(line => line.status === 'PENDING')

        // await prisma.receiptScans.update({
        //     where: {
        //         id: scan.id
        //     },
        //     data: {
        //         lines: updatedLines,
        //         status: unconfirmedLines.length === 0 ? 'COMPLETED' : 'PENDING'
        //     }
        // })

        return unconfirmedLines.length === 0 ? undefined : {
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

        const itemQuantity = actionedInfo?.quantityChange || currentActionableLine.quantity

        const id = generateLearnedLineId(currentActionableLine)

        const existingLearnedLine = await prisma.learnedReceiptLines.findFirst({
            where: {
                id
            },
        })


        const itemChange = itemQuantity * (actionedInfo?.quantityMultiplier || existingLearnedLine?.quantityMultiplier || 1)

        let currentItem = null
        if (actionedInfo?.itemId) {
            currentItem = await prisma.items.findUnique({
                where: {
                    id: actionedInfo.itemId
                }
            })

            if (!currentItem) {
                throw new Error('Item not found for different item confirmation')
            }

            const updatedQuantity = currentItem.quantity + itemChange

            await prisma.items.update({
                where: {
                    id: actionedInfo.itemId
                },
                data: {
                    quantity: updatedQuantity
                }
            })


            if (existingLearnedLine) {
                if (existingLearnedLine?.itemId !== actionedInfo.itemId) {
                    await prisma.learnedReceiptLines.update({
                        where: {
                            id: existingLearnedLine.id
                        },
                        data: {
                            itemId: actionedInfo.itemId,
                            ignore: false,
                            quantityMultiplier: actionedInfo?.quantityMultiplier || 1,
                        }
                    })
                }
            } else {
                const id = generateLearnedLineId(currentActionableLine)
                await prisma.learnedReceiptLines.create({
                    data: {
                        id,
                        title: currentActionableLine.title,
                        sku: currentActionableLine.sku,
                        upc: currentActionableLine.upc,
                        hsn: currentActionableLine.hsn,
                        reference: currentActionableLine.reference,
                        quantityMultiplier: actionedInfo?.quantityMultiplier || 1,
                        itemId: actionedInfo.itemId,
                        ignore: false,
                    }
                })
            }
        }
        else if (actionedInfo?.ignore) {
            if (existingLearnedLine) {
                if (!existingLearnedLine?.ignore) {
                    await prisma.learnedReceiptLines.update({
                        where: {
                            id: existingLearnedLine.id
                        },
                        data: {
                            itemId: null,
                            ignore: true,
                        }
                    })

                }
            } else {
                const id = generateLearnedLineId(currentActionableLine)
                await prisma.learnedReceiptLines.create({
                    data: {
                        id,
                        title: currentActionableLine.title,
                        sku: currentActionableLine.sku,
                        upc: currentActionableLine.upc,
                        hsn: currentActionableLine.hsn,
                        reference: currentActionableLine.reference,
                        quantityMultiplier: currentActionableLine.actionableInfo?.quantityMultiplier || 1,
                        ignore: true,
                    }
                })
            }
            console.info('Line Ignored')
        } else if (currentActionableLine.actionableInfo?.ignore) {
            console.info('Line Ignored')
        } else if (currentActionableLine.actionableInfo?.existingItemId) {

            currentItem = await prisma.items.findUnique({
                where: {
                    id: currentActionableLine.actionableInfo.existingItemId
                }
            })

            if (!currentItem) {
                throw new Error('Item not found for different item confirmation')
            }

            const updatedQuantity = currentItem.quantity + itemChange

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
                    actionableInfo: {
                        ...l.actionableInfo,
                        existingItemId: actionedInfo?.itemId || l.actionableInfo?.existingItemId || null,
                        ignore: actionedInfo?.ignore || l.actionableInfo?.ignore || null,
                        existingItemTitle: l.actionableInfo.existingItemTitle || currentItem?.title || null
                    },
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

        return unconfirmedLines.length === 0 ? undefined : {
            lines: unconfirmedLines
        }
    }

    const getCurrentMonthScans = async (args: {
        ownerId: string,
    }) => {

        const { ownerId } = args

        const currentDate = new Date()
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

        const scanNumber = await prisma.verifyScans.count({
            where: {
                ownerId,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        })

        return {
            number: scanNumber
        }

    }

    return {
        uploadReceipt,
        deleteReceiptScan,
        deleteAllUserReceiptScans,
        getCurrentScan,
        confirmReceiptScan,
        confirmReceiptLine,
        cancelReceiptScan,
        getCurrentMonthScans,
        parseReceiptReponse,
        migrateLearnedLines1
    }
}
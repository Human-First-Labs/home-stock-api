import { Router } from 'express'
import { IReceiptService } from '../services/receipt-service'
import { sendExpressError } from '../util'

export const ReceiptRouter = (args: {
    receiptService: IReceiptService
}) => {
    const router = Router()
    const { receiptService } = args

    router.post('/upload/receipt', async (req, res) => {
        const { user } = res.locals
        const { base64, extension } = req.body

        try {

            const result = await receiptService.uploadReceipt({
                base64,
                extension,
                ownerId: user.id
            })
            res.status(200).json(result)
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.get('/get/current/lines', async (_, res) => {
        const { user } = res.locals

        try {
            if (!user) {
                throw new Error('User not found')
            }

            const lines = await receiptService.getCurrentScan({
                ownerId: user.id
            })
            res.status(200).json(lines)
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.patch('/cancel/receipt/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params

        try {
            if (!user) {
                throw new Error('User not found')
            }

            if (!id) {
                throw new Error('Receipt ID is required')
            }

            await receiptService.cancelReceiptScan({
                ownerId: user.id,
                receiptScanId: id
            })
            res.status(200).send({ message: 'Receipt cancelled successfully' })
        } catch (e: any) {
            sendExpressError(res, e)
        }

    })

    router.post('/confirm/receipt/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params

        try {
            if (!user) {
                throw new Error('User not found')
            }

            if (!id) {
                throw new Error('Receipt ID is required')
            }

            await receiptService.confirmReceiptScan({
                ownerId: user.id,
                receiptScanId: id
            })
            res.status(200).send({ message: 'Receipt confirmed successfully' })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.post('/confirm/receipt/line/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params
        const { actionedInfo, line } = req.body

        try {
            if (!user) {
                throw new Error('User not found')
            }

            if (!id) {
                throw new Error('Receipt Line ID is required')
            }

            if (!actionedInfo) {
                throw new Error('Actioned info is required')
            }

            await receiptService.confirmReceiptLine({
                ownerId: user.id,
                receiptScanId: id,
                line,
                actionedInfo
            })
            res.status(200).send({ message: 'Receipt line confirmed successfully' })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })


    return router
}

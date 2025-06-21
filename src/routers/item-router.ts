import { Router } from 'express'
import { IItemService } from '../services/item-service'
import { sendExpressError, customError, errorCodes } from '../util'

export const ItemRouter = (args: {
    itemService: IItemService
}) => {
    const router = Router()
    const { itemService } = args

    router.post('/create/item', async (req, res) => {
        const { user } = res.locals
        const { title, warningAmount, quantity } = req.body

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!title) {
                throw customError('Title is required', errorCodes.clientSide)
            }

            if (quantity === undefined || quantity === null) {
                throw customError('Quantity is required', errorCodes.clientSide)
            }

            const item = await itemService.createItem({
                ownerId: user.id,
                title,
                warningAmount,
                quantity: quantity
            })

            res.status(201).send({
                item,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.post('/create/item/from-receipt-line', async (req, res) => {
        const { user } = res.locals
        const { title, warningAmount, quantity, receiptLineId } = req.body

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!title) {
                throw customError('Title is required', errorCodes.clientSide)
            }

            if (!receiptLineId) {
                throw customError('Receipt Line ID is required', errorCodes.clientSide)
            }

            const item = await itemService.createItemFromReceiptLine({
                ownerId: user.id,
                title,
                warningAmount,
                quantity: quantity || 0, // Default quantity is set to 0
                receiptLineId,
            })

            res.status(201).send({
                item,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.patch('/update/item/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params
        const { title, warningAmount, quantity } = req.body

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!id) {
                throw customError('Item ID is required', errorCodes.clientSide)
            }

            const item = await itemService.updateItem({
                ownerId: user.id,
                id,
                title,
                warningAmount,
                quantity
            })

            res.status(200).send({
                item,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }

    })

    router.patch('/update/item/quantity/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params
        const { quantityChange } = req.body

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!id) {
                throw customError('Item ID is required', errorCodes.clientSide)
            }

            if (quantityChange === undefined || quantityChange === null) {
                throw customError('Quantity Change is required', errorCodes.clientSide)
            }

            const item = await itemService.updateItemQuantity({
                ownerId: user.id,
                itemId: id,
                quantityChange
            })

            res.status(200).send({
                item,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.delete('/delete/item/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!id) {
                throw customError('Item ID is required', errorCodes.clientSide)
            }

            await itemService.deleteItem({
                ownerId: user.id,
                id,
            })

            res.status(200).send({
                message: 'Item deleted successfully',
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.post('/generate/shopping-list', async (_, res) => {
        const { user } = res.locals

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            // Assuming itemService has a method to generate shopping lists
            await itemService.generateShoppingList({
                ownerId: user.id,
            })

            res.status(200).send()
        } catch (e: any) {
            sendExpressError(res, e)
        }

    })

    //-------------------------------------------------------------------------------------------------------

    router.get('/get/my-items', async (_, res) => {
        const { user } = res.locals

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            const items = await itemService.getItems({
                ownerId: user.id,
            })

            res.status(200).send({
                items,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.get('/get/my-shopping-lists', async (_, res) => {
        const { user } = res.locals

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            const shoppingLists = await itemService.getShoppingLists({
                ownerId: user.id,
            })

            res.status(200).send({
                shoppingLists,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.get('/get/shopping-list/:id', async (req, res) => {
        const { user } = res.locals
        const { id } = req.params

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!id) {
                throw customError('Shopping List ID is required', errorCodes.clientSide)
            }

            const shoppingList = await itemService.getShoppingList({
                ownerId: user.id,
                id,
            })

            res.status(200).send({
                shoppingList,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }

    })

    return router
}

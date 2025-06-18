import { PrismaClient } from "@prisma/client"

export type IItemService = ReturnType<typeof ItemService>

export const ItemService = (args: { prisma: PrismaClient }) => {
    const { prisma } = args

    const createItem = async (args: { ownerId: string, title: string, warningAmount?: number, quantity: number }) => {
        const { ownerId, title, warningAmount, quantity } = args

        const item = await prisma.items.create({
            data: {
                ownerId,
                title,
                warningAmount,
                quantity // Default quantity is set to 0
            }
        })

        return item
    }

    const createItemFromReceiptLine = async (args: { ownerId: string, title: string, warningAmount?: number, quantity: number, receiptLineId: string }) => {
        const { ownerId, title, warningAmount, quantity, receiptLineId } = args

        const item = await createItem({
            ownerId,
            title,
            warningAmount,
            quantity
        })

        await prisma.learnedReceiptLines.update({
            where: {
                id: receiptLineId
            },
            data: {
                itemId: item.id
            }
        })

        return item

    }

    const updateItem = async (args: { ownerId: string, id: string, title?: string, warningAmount?: number }) => {
        const { ownerId, id, title, warningAmount } = args

        const currentItem = await prisma.items.findUnique({
            where: {
                id,
                ownerId
            }
        })

        if (!currentItem) {
            throw new Error('Item not found')
        }


        const item = await prisma.items.update({
            where: {
                id: currentItem.id
            },
            data: {
                title,
                warningAmount
            }
        })

        return item
    }

    const updateItemQuantity = async (args: { ownerId: string, itemId: string, quantityChange: number }) => {
        const { ownerId, itemId, quantityChange } = args

        const item = await prisma.items.findUnique({
            where: {
                id: itemId,
                ownerId
            }
        })

        if (!item) {
            throw new Error('Item not found')
        }

        if (quantityChange === 0) {
            throw new Error('Quantity change cannot be zero')
        }

        const newQuantity = item.quantity + quantityChange

        return await prisma.items.update({
            where: {
                id: item.id
            },
            data: {
                quantity: newQuantity
            }
        })
    }

    const deleteItem = async (args: { ownerId: string, id: string }) => {
        const { ownerId, id } = args

        const item = await prisma.items.findUnique({
            where: {
                id,
                ownerId
            }
        })

        if (!item) {
            throw new Error('Item not found')
        }

        await prisma.learnedReceiptLines.deleteMany({
            where: {
                itemId: id
            }
        })

        await prisma.items.delete({
            where: {
                id
            }
        })
    }

    const deleteAllUserItems = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const items = await prisma.items.findMany({
            where: {
                ownerId
            }
        })

        await Promise.all(items.map(async item => {
            await deleteItem({
                ownerId,
                id: item.id
            })
        }))
    }

    const generateShoppingList = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const items = await prisma.items.findMany({
            where: {
                ownerId
            }
        })

        const shoppingList = (await Promise.all(items.map(async item => {

            if (item.warningAmount === null || item.warningAmount === undefined) {
                return undefined
            }

            if (item.quantity < item.warningAmount) {
                return {
                    ...item,
                    currentQuantity: item.quantity
                }
            } else {
                return undefined
            }
        }))).filter(item => item !== undefined)

        await prisma.shoppingList.create({
            data: {
                ownerId,
                items: shoppingList.map(item => (
                    {
                        currentQuantity: item.currentQuantity,
                        itemId: item.id,
                        title: item.title,
                        warningAmount: item.warningAmount as number
                    }
                ))
            }
        })
    }

    const deleteShoppingList = async (args: { ownerId: string, id: string }) => {
        const { ownerId, id } = args

        const shoppingList = await prisma.shoppingList.findUnique({
            where: {
                id,
                ownerId
            }
        })

        if (!shoppingList) {
            throw new Error('Shopping list not found')
        }

        await prisma.shoppingList.delete({
            where: {
                id
            }
        })
    }

    const deleteAllUserShoppingLists = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const shoppingLists = await prisma.shoppingList.findMany({
            where: {
                ownerId
            }
        })

        await Promise.all(shoppingLists.map(async shoppingList => {
            await deleteShoppingList({
                ownerId,
                id: shoppingList.id
            })
        })
        )
    }

    //TODO maybe pagination at some point
    const getItems = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const items = await prisma.items.findMany({
            where: {
                ownerId
            }
        })

        return items
    }

    //TODO maybe pagination at some point
    const getShoppingLists = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const shoppingLists = await prisma.shoppingList.findMany({
            where: {
                ownerId
            }
        })

        return shoppingLists
    }

    const getShoppingList = async (args: { ownerId: string, id: string }) => {
        const { ownerId, id } = args

        const shoppingList = await prisma.shoppingList.findUnique({
            where: {
                id,
                ownerId
            }
        })

        return shoppingList
    }


    return {
        createItem,
        createItemFromReceiptLine,
        updateItem,
        updateItemQuantity,
        generateShoppingList,
        deleteItem,
        getItems,
        deleteAllUserItems,
        getShoppingLists,
        getShoppingList,
        deleteShoppingList,
        deleteAllUserShoppingLists,

    }
}
import { PrismaClient } from "@prisma/client"

export type IItemService = ReturnType<typeof ItemService>

export const ItemService = (args: { prisma: PrismaClient }) => {
    const { prisma } = args

    const getItemQuantity = async (args: { itemId: string }) => {
        const { itemId } = args

        const item = await prisma.items.findFirst({
            where: {
                id: itemId
            }
        })

        if (!item) {
            throw new Error('Item not found')
        }

        const quantities = await prisma.itemQuantities.findMany({
            where: {
                itemId
            }
        })

        return quantities.reduce((acc, curr) => acc + curr.quantity, 0)

    }

    const createItem = async (args: { ownerId: string, title: string, warningAmount?: number }) => {
        const { ownerId, title, warningAmount } = args

        const item = await prisma.items.create({
            data: {
                ownerId,
                title,
                warningAmount
            }
        })

        return item
    }

    const updateItem = async (args: { ownerId: string, id: string, title?: string, warningAmount?: number }) => {
        const { ownerId, id, title, warningAmount } = args

        const currentItem = await prisma.items.findFirst({
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
                id,
                ownerId
            },
            data: {
                title,
                warningAmount
            }
        })

        return item
    }

    const manuallyUpdateItemQuantity = async (args: { ownerId: string, itemId: string, quantity: number }) => {
        const { ownerId, itemId, quantity } = args

        const item = await prisma.items.findFirst({
            where: {
                id: itemId,
                ownerId
            }
        })

        if (!item) {
            throw new Error('Item not found')
        }

        await prisma.itemQuantities.create({
            data: {
                itemId,
                quantity
            }
        })
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

            const totalQuantity = await getItemQuantity({
                itemId: item.id
            })

            if (totalQuantity < item.warningAmount) {
                return {
                    ...item,
                    currentQuantity: totalQuantity
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

    const deleteItem = async (args: { ownerId: string, id: string }) => {
        const { ownerId, id } = args

        const item = await prisma.items.findFirst({
            where: {
                id,
                ownerId
            }
        })

        if (!item) {
            throw new Error('Item not found')
        }

        await prisma.receiptLines.deleteMany({
            where: {
                itemId: id
            }
        })

        await prisma.itemQuantities.deleteMany({
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

    const deleteShoppingList = async (args: { ownerId: string, id: string }) => {
        const { ownerId, id } = args

        const shoppingList = await prisma.shoppingList.findFirst({
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

    const getItems = async (args: { ownerId: string }) => {
        const { ownerId } = args

        const items = await prisma.items.findMany({
            where: {
                ownerId
            }
        })

        const resolvedItems = await Promise.all(items.map(async item => {
            const quantity = await getItemQuantity({
                itemId: item.id
            })

            return {
                ...item,
                quantity
            }
        }))

        return resolvedItems
    }

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

        const shoppingList = await prisma.shoppingList.findFirst({
            where: {
                id,
                ownerId
            }
        })

        return shoppingList
    }


    return {
        createItem,
        updateItem,
        manuallyUpdateItemQuantity,
        generateShoppingList,
        deleteItem,
        getItems,
        deleteAllUserItems,
        getShoppingLists,
        getShoppingList,
        deleteShoppingList,
        deleteAllUserShoppingLists

    }
}
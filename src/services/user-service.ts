import { PrismaClient, Users } from '@prisma/client'
import { ISupabaseService } from './supabase-service'
import { customError, errorCodes } from '../util'
import { ISocketService } from '../socket/socket-service'
import { IItemService } from './item-service'
import { IReceiptService } from './receipt-service'

export type IUserService = ReturnType<typeof UserService>

export const UserService = (args: {
    prisma: PrismaClient
    supabaseService: ISupabaseService,
    socketService: ISocketService,
    itemService: IItemService,
    receiptService: IReceiptService
}) => {
    const { prisma, supabaseService, socketService, itemService, receiptService } = args

    // Setters for the App Frontend----------------------------------------------

    //This function allows the user to update their display name
    const runUserIntroduction = async (args: {
        userId: string
        displayName: string
        terms: boolean
    }) => {
        const { userId, displayName, terms } = args

        if (!terms) {
            throw new Error('Terms is missing or not accepted')
        }

        await prisma.users.update({
            where: {
                id: userId
            },
            data: {
                displayName,
                acceptedTermsOn: new Date(),
            }
        })

        socketService.emitRequiredEvents({
            eventArgs: {
                id: userId
            },
            eventName: 'getUserById',
            pullData: getUserById
        })
    }

    const createUser = async () => {
        const data = await supabaseService.createTestUser()

        if (!data.data.user) {
            throw new Error('User not created')
        }

        await prisma.users.create({
            data: {
                supabaseUid: data.data.user?.id,
                contactInfo: {
                    phone: {
                        phone: '1234567890',
                    }
                },
                displayName: 'Maurovic Cachia'
            }
        })
    }

    //This function allows the user to accept the terms and conditions
    const updateTermsAcceptance = async (args: { userId: string; terms: boolean }) => {
        const { userId, terms } = args

        if (!terms) {
            throw new Error('Terms is missing or not accepted')
        }

        await prisma.users.update({
            where: {
                id: userId
            },
            data: {
                acceptedTermsOn: new Date()
            }
        })

        socketService.emitRequiredEvents({
            eventArgs: {
                id: userId
            },
            eventName: 'getUserById',
            pullData: getUserById
        })
    }

    //This function allows the user to update their display name
    const updateUserDisplayName = async (args: { userId: string; displayName: string }) => {
        const { userId, displayName } = args

        if (!displayName) {
            throw new Error('Display name is missing')
        }

        await prisma.users.update({
            where: {
                id: userId
            },
            data: {
                displayName
            }
        })

        socketService.emitRequiredEvents({
            eventArgs: {
                id: userId
            },
            eventName: 'getUserById',
            pullData: getUserById
        })
    }

    //This function allows the user to upload images for their account
    const updateUserImages = async (args: {
        user: Users
        images: ({
            base64: string
            fullName: string
        } | {
            path: string
        })[]
    }) => {
        const { user, images } = args

        const currentImagePaths = user.imagePaths || []

        const newImagePaths: string[] = []

        for (let i = 0; i < images.length; i++) {
            const image = images[i]
            if ('base64' in image) {
                const extension = image.fullName.split('.').pop()

                const { path } = await supabaseService.uploadImage({
                    base64: image.base64,
                    nameWithExtension: `${user.id}-${i}.${extension}`,
                    path: 'users'
                })
                newImagePaths.push(path)
            } else {
                newImagePaths.push(image.path)
            }
        }

        const pathsToBeRemoved = currentImagePaths.filter((path) => !newImagePaths.includes(path))

        for (let i = 0; i < pathsToBeRemoved.length; i++) {
            await supabaseService.deleteImage({
                path: pathsToBeRemoved[i]
            })
        }


        await prisma.users.update({
            where: {
                id: user.id
            },
            data: {
                imagePaths: newImagePaths
            }
        })

        socketService.emitRequiredEvents({
            eventArgs: {
                id: user.id
            },
            eventName: 'getUserById',
            pullData: getUserById
        })
    }

    const deleteUser = async (args: {
        userId: string
    }) => {
        const { userId } = args

        const user = await prisma.users.findUnique({
            where: {
                id: userId
            }
        })


        if (!user) {
            throw customError('User not found', errorCodes.clientSide)
        }

        await itemService.deleteAllUserItems({
            ownerId: userId
        })

        await itemService.deleteAllUserShoppingLists({
            ownerId: userId
        })

        await receiptService.deleteAllUserReceiptScans({
            ownerId: userId
        })

        await supabaseService.deleteSupabaseUser({
            uid: user.supabaseUid
        })

        await prisma.users.delete({
            where: {
                id: userId
            }
        })
    }

    // Getters for the App Frontend--------------------------------------------
    const getUserById = async (args: {
        id: string
    }) => {
        const { id } = args

        const user = await prisma.users.findUnique({
            where: {
                id
            }
        })

        if (!user) {
            throw customError('User not found', errorCodes.clientSide)
        }

        return user
    }


    return {
        updateTermsAcceptance,
        runUserIntroduction,
        updateUserDisplayName,
        updateUserImages,
        getUserById,
        createUser,
        deleteUser
    }
}

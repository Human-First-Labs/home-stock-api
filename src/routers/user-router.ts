import { Router } from 'express'
import { IUserService } from '../services/user-service'
import { sendExpressError, customError, errorCodes } from '../util'
import { ISocketService } from '../socket/socket-service'
import { SocketEvent } from '../socket/types'

export const UserRouter = (args: {
    userService: IUserService,
    socketService: ISocketService
}) => {
    const router = Router()
    const { userService, socketService } = args

    router.post('/run/user/intro', async (req, res) => {
        const { user } = res.locals
        const { displayName, terms } = req.body

        try {

            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }


            if (!displayName) {
                throw customError('Display Name is required', errorCodes.clientSide)
            }

            await userService.runUserIntroduction({
                displayName,
                terms,
                userId: user.id,
            })
        } catch (e: any) {
            sendExpressError(res, e)

        }
    })

    router.post('/update/user/terms', async (req, res) => {
        const { user } = res.locals
        const { terms } = req.body

        try {

            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!terms) {
                throw customError('Terms are required', errorCodes.clientSide)
            }

            await userService.updateTermsAcceptance({
                terms,
                userId: user.id,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.post('/update/user/displayName', async (req, res) => {
        const { user } = res.locals
        const { displayName } = req.body

        try {
            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!displayName) {
                throw customError('Display Name is required', errorCodes.clientSide)
            }

            await userService.updateUserDisplayName({
                displayName,
                userId: user.id,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.post('/update/user/images', async (req, res) => {
        const { user } = res.locals
        const { images } = req.body

        try {

            if (!user) {
                throw customError('User not found', errorCodes.authorization)
            }

            if (!images) {
                throw customError('Images are required', errorCodes.clientSide)
            }

            await userService.updateUserImages({
                images,
                user
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }

    })

    //-------------------------------------------------------------------------------------------------------

    router.get('/get/my-user', async (req, res) => {
        const { user } = res.locals
        const headers = req.headers

        try {
            let event: SocketEvent | null = null
            if (user) {
                event = await socketService.handleSocketHeaders({
                    headers,
                    eventName: 'getUserById',
                    argument: {
                        id: user.id
                    }
                })
            }
            res.status(200).send({
                user,
                socketEvent: event
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    return router
}

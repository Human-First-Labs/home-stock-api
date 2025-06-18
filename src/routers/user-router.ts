import { Router } from 'express'
import { IUserService } from '../services/user-service'
import { sendExpressError, customError, errorCodes } from '../util'

export const UserRouter = (args: {
    userService: IUserService
}) => {
    const router = Router()
    const { userService } = args

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

    router.get('/get/my-user', async (_, res) => {
        const { user } = res.locals

        try {
            res.status(200).send({
                user,
            })
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    return router
}

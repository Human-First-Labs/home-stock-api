import { Router } from 'express'
import { ISupabaseService } from '../services/supabase-service'
import { customError, errorCodes, sendExpressError } from '../util'

export const SupabaseRouter = (args: {
    supabaseService: ISupabaseService
}) => {
    const router = Router()
    const { supabaseService } = args

    router.use(async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1]

        try {
            if (!token) {
                throw customError('No token provided!!', errorCodes.authentication)
            }

            const decodedToken = await supabaseService.validateSupabaseToken({
                token
            })

            if (!decodedToken) {
                throw customError('Invalid token.', errorCodes.authentication)
            }

            if (decodedToken.is_anonymous) {
                res.locals.anon = decodedToken.is_anonymous

                next()
            } else {
                const uid = decodedToken.uid || decodedToken.sub

                const result = await supabaseService.getOrCreateUserFromUid({
                    uid,
                    anon: decodedToken.is_anonymous,
                    phone: decodedToken.phone
                })

                res.locals.phone = decodedToken.phone
                res.locals.user = result.user
                res.locals.anon = result.anon

                next()
            }
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    router.use(async (_, res, next) => {
        const { user, anon } = res.locals

        if (!user && !anon) {
            sendExpressError(
                res,
                customError('No user found and not anon', errorCodes.serverSide)
            )
        } else {
            next()
        }
    })

    return router
}

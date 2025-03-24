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
            console.log('decodedToken', decodedToken)

            const uid = decodedToken.uid || decodedToken.sub

            console.log('uid', uid)

            if (uid) {
                const result = await supabaseService.getOrCreateUserFromUid({
                    uid,
                    phone: decodedToken.phone ? {
                        phone: decodedToken.phone,
                        verified: decodedToken.user_metadata?.phone_verified
                    } : undefined,
                    email: decodedToken.email ? {
                        email: decodedToken.email,
                        verified: decodedToken.user_metadata?.email_verified
                    } : undefined
                })

                res.locals.phone = decodedToken.phone
                res.locals.user = result.user
            }

            next()
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    return router
}

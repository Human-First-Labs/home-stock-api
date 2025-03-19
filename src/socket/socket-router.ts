import { Router } from 'express'
import { customError, errorCodes, sendExpressError } from '../util'
import { ISocketService } from './socket-service'

export const SocketRouter = (args: { socketService: ISocketService }) => {
    const router = Router()
    const { socketService } = args

    // router.post('/update-socket-events', async (req, res) => {
    //     const { socketId, events } = req.body

    //     try {
    //         if (!socketId) {
    //             throw customError('Socket ID is missing', errorCodes.clientSide)
    //         }

    //         if (!events) {
    //             throw customError('Events are missing', errorCodes.clientSide)
    //         }

    //         await socketService.upsertSocketEvents({ socketId, events })
    //         res.status(200).send()
    //     } catch (e: any) {
    //         sendExpressError(res, e)
    //     }
    // })

    router.post('/remove-socket-event', async (req, res) => {
        const { eventId } = req.body

        try {

            if (!eventId) {
                throw customError('Event Id are missing', errorCodes.clientSide)
            }

            await socketService.removeSocketEvent({ eventId })
            res.status(200).send()
        } catch (e: any) {
            sendExpressError(res, e)
        }
    })

    return router
}

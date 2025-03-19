import http, { IncomingHttpHeaders } from 'http'
import { Server } from 'socket.io'
import { guard } from '@ucast/mongo2js'
import { SocketEvent, SocketEventName } from './types'
import { v4 } from 'uuid'
import { customError } from '../util'

export type ISocketService = Awaited<ReturnType<typeof SocketService>>

export const SocketService = (args: { httpServer: http.Server }) => {
    const {
        httpServer
    } = args

    let currentEvents: {
        [id: string]: Omit<SocketEvent, 'id'> & { socketId: string }
    } = {}

    const server = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET'],
            credentials: false
        },
        transports: ['websocket'] // Explicitly allowing both transports
    })

    server.on('connect', (socket) => {
        console.log(`Client connected: ${socket.id}`)

        socket.on('disconnect', async () => {
            const ids = Object.keys(currentEvents)

            for (let i = 0; i < ids.length; i++) {
                if (currentEvents[ids[i]] && currentEvents[ids[i]].socketId === socket.id) {
                    delete currentEvents[ids[i]]
                }
            }

            console.log(`Client disconnected: ${socket.id}`)
        })
    })

    const upsertEvent = async (args: { eventId?: string, event: Omit<SocketEvent, 'id'>, socketId: string }) => {
        const { eventId, event, socketId } = args

        if (eventId && !currentEvents[eventId]) {
            throw customError('Cannot Update inexistant event', 400)
        }


        if (eventId) {
            currentEvents[eventId] = {
                ...currentEvents[eventId],
                args: event.args
            }

            return {
                id: eventId,
                name: currentEvents[eventId].name,
                args: event.args
            }
        } else {
            const id = v4()

            currentEvents[id] = {
                args: event.args,
                name: event.name,
                socketId
            }

            return {
                id,
                args: event.args,
                name: event.name
            }
        }
    }

    const removeSocketEvent = async (args: { eventId: string }) => {
        const { eventId } = args

        if (currentEvents[eventId]) {
            delete currentEvents[eventId]
        }

    }

    const emitRequiredEvents = async (args: {
        eventName: string
        eventArgs?: unknown
        pullData: (args: any) => Promise<any>
    }) => {
        const { eventName, eventArgs, pullData } = args

        const currentEventList: (SocketEvent & { socketId: string })[] = []

        const currentEventIds = Object.keys(currentEvents)

        for (let i = 0; i < currentEventIds.length; i++) {
            currentEventList.push({
                ...currentEvents[currentEventIds[i]],
                id: currentEventIds[i],
            })
        }

        const filteredSocketEvents = currentEventList.filter((currentEvent) => {
            if (currentEvent.name === eventName) {
                if (eventArgs) {
                    if (currentEvent.args) {
                        return guard(eventArgs)(currentEvent.args)
                    } else {
                        return true
                    }
                } else {
                    return true
                }
            } else {
                return false
            }
        })

        for (const socketEvent of filteredSocketEvents) {
            const data = await pullData(socketEvent.args ? socketEvent.args : undefined)

            console.log('emitting to ', socketEvent.id)
            server.emit(socketEvent.id, data)
        }
    }

    const handleSocketHeaders = async (args: {
        headers: IncomingHttpHeaders
        eventName: SocketEventName
        argument?: {
            [key: string]: unknown;
        } | undefined
    }) => {
        const { headers, eventName, argument } = args

        if (!headers['x-socket-id']) {
            return null
        }

        const socketId: string = headers['x-socket-id'] as string
        const eventId: string = headers['x-socket-event-id'] as string

        if (socketId) {
            const event = await upsertEvent({
                eventId,
                event: {
                    name: eventName,
                    args: argument
                },
                socketId
            })

            return event
        } else {
            return null
        }


    }

    return {
        emitRequiredEvents,
        removeSocketEvent,
        // upsertEvent,
        handleSocketHeaders
    }
}

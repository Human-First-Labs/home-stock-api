import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import http from 'http'
import { PORT } from './env/system'
import { PrismaClient } from '@prisma/client'
import { SupabaseService } from './services/supabase-service'
import { Settings } from 'luxon'
import { UserService } from './services/user-service'
import { SupabaseRouter } from './routers/supabase-router'
import { UserRouter } from './routers/user-router'
import { SocketService } from './socket/socket-service'
import { SocketRouter } from './socket/socket-router'
import { ItemService } from './services/item-service'
import { VeryfiService } from './services/veryfi-service'
import { ReceiptService } from './services/receipt-service'
import { sendExpressError, customError, errorCodes } from './util'

const main = async () => {
    //Database Setup
    console.log('Connecting to Database')

    const prisma = new PrismaClient()
    await prisma.$connect()

    console.log('Connected to Database')

    //Express Setup
    const app = express()
    app.use(cors())
    app.use(express.json({ limit: '16mb' }))
    app.use(morgan('dev'))

    //Auth Service
    const supabaseService = SupabaseService({
        prisma
    })

    //Socket IO Setup
    const httpServer = http.createServer(app)

    const socketService = SocketService({
        httpServer
    })


    //Timezone Setup
    Settings.defaultZone = "Europe/Malta"

    const veryfiService = VeryfiService({
        prisma,
        supabaseService
    })

    const itemService = ItemService({
        prisma
    })
    const receiptService = ReceiptService({
        prisma,
        veryfiService,
    })
    const userService = UserService({
        prisma,
        supabaseService,
        socketService,
        itemService,
        receiptService
    })

    //Local Routers
    const supabaseRouter = SupabaseRouter({ supabaseService })

    const userRouter = UserRouter({
        userService,
        socketService
    })
    const socketRouter = SocketRouter({
        socketService
    })


    //API Routes
    app.use(supabaseRouter)

    app.use(socketRouter)

    app.use(async (_, res, next) => {
        const { user } = res.locals

        console.log('user', user)

        if (!user) {
            sendExpressError(
                res,
                customError('No user found', errorCodes.serverSide)
            )
        } else {
            next()
        }
    })

    app.use(userRouter)



    await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve))

    console.info(`Server is running on port ${PORT}`)
}

main()

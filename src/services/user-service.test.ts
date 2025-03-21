//unit tests for settings-service.ts

import { PrismaClient } from '@prisma/client'
import { UserService } from './user-service'
import { SupabaseService } from './supabase-service'
import { SocketService } from '../socket/socket-service'
import http from 'http'
import express from 'express'
import { ItemService } from './item-service'
import { ReceiptService } from './receipt-service'
import { VeryfiService } from './veryfi-service'

describe('User Service', () => {
    const prisma = new PrismaClient()

    const app = express()
    const httpServer = http.createServer(app)

    const supabaseService = SupabaseService({
        prisma
    })
    const socketService = SocketService({
        httpServer
    })

    const itemService = ItemService({
        prisma
    })

    const veryfiService = VeryfiService({
        prisma,
        supabaseService
    })

    const receiptService = ReceiptService({
        prisma,
        veryfiService
    })

    const userService = UserService({
        prisma,
        socketService,
        supabaseService,
        itemService,
        receiptService
    })

    it('run verify image test', async () => {
        await userService.createUser()
    })
})

//unit tests for settings-service.ts

import { PrismaClient } from '@prisma/client'
import { UserService } from './user-service'
import { SupabaseService } from './supabase-service'
import { SocketService } from '../socket/socket-service'
import http from 'http'
import express from 'express'

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
    const userService = UserService({
        prisma,
        socketService,
        supabaseService
    })

    it('run verify image test', async () => {
        await userService.createUser()
    })
})

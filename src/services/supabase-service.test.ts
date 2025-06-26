//unit tests for settings-service.ts

import { PrismaClient } from '@prisma/client'
import { SupabaseService } from './supabase-service'

describe('Supabase Service', () => {
    const prisma = new PrismaClient()

    const supabaseService = SupabaseService({
        prisma
    })

    it('run verify image test', async () => {
        await supabaseService.createTestUser()
    })
})

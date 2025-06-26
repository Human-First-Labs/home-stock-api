import Client from "@veryfi/veryfi-sdk"
import { VERYFI_API_KEY, VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME } from "../env/veryfi"
import { ISupabaseService } from "./supabase-service"
import { PrismaClient } from "@prisma/client"

export type IVeryfiService = ReturnType<typeof VeryfiService>

export const VeryfiService = (args: { prisma: PrismaClient, supabaseService: ISupabaseService }) => {
    const { supabaseService, prisma } = args


    const veryfi = new Client(VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME, VERYFI_API_KEY)

    const processReceipt = async (args: { ownerId: string, base64: string; extension: string }) => {
        const { base64, ownerId, extension } = args

        const fullName = `${Date.now()}-${ownerId}.${extension}`

        const currentDate = new Date()
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

        const currentMonthScans = await prisma.verifyScan.count({
            where: {
                ownerId,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        })

        if (currentMonthScans >= 10) {
            throw new Error('You have reached the maximum number of scans for this month. Please try again next month.')
        }

        const uploaded = await supabaseService.uploadImage({
            base64,
            nameWithExtension: fullName,
            path: 'receipts'
        })

        await prisma.verifyScan.create({
            data: {
                ownerId,
            }
        })

        const url = await supabaseService.createSignedFileUrl({
            path: uploaded.path
        })

        const response = await veryfi.process_document_from_url(url.signedUrl)

        return {
            rawResponse: response,
            path: uploaded.path,
        }
    }

    return {
        processReceipt
    }
}
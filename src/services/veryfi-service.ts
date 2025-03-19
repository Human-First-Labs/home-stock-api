import { PrismaClient } from "@prisma/client"
import Client from "@veryfi/veryfi-sdk"
import { VERYFI_API_KEY, VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME } from "../env/veryfi"
import { ISupabaseService } from "./supabase-service"

export type IVeryfiService = ReturnType<typeof VeryfiService>

export const VeryfiService = (args: { prisma: PrismaClient, supabaseService: ISupabaseService }) => {
    const { prisma, supabaseService } = args


    const veryfi = new Client(VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME, VERYFI_API_KEY)

    const processReceipt = async (args: { ownerId: string, base64: string; extension: string }) => {
        const { base64, ownerId, extension } = args

        const fullName = `${Date.now()}-${ownerId}.${extension}`

        const uploaded = await supabaseService.uploadImage({
            base64,
            nameWithExtension: fullName,
            path: 'receipts'
        })

        const url = await supabaseService.createSignedFileUrl({
            path: uploaded.path
        })

        const response = await veryfi.process_document_from_url(url.signedUrl)

        const savedScan = await prisma.receiptScans.create({
            data: {
                ownerId,
                imagePath: uploaded.path,
                rawData: JSON.stringify(response),
            }
        })


        return {
            rawResponse: response,
            scanEntity: savedScan
        }
    }

    return {
        processReceipt
    }
}
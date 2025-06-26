import { config } from 'dotenv'

config()

if (!process.env.VERYFI_CLIENT_ID) {
    throw new Error('VERYFI_CLIENT_ID environment variable not set')
}

if (!process.env.VERYFI_CLIENT_SECRET) {
    throw new Error('VERYFI_CLIENT_SECRET environment variable not set')
}

if (!process.env.VERYFI_USERNAME) {
    throw new Error('VERYFI_USERNAME environment variable not set')
}

if (!process.env.VERYFI_API_KEY) {
    throw new Error('VERYFI_API_KEY environment variable not set')
}

export const VERYFI_CLIENT_ID = process.env.VERYFI_CLIENT_ID
export const VERYFI_CLIENT_SECRET = process.env.VERYFI_CLIENT_SECRET
export const VERYFI_USERNAME = process.env.VERYFI_USERNAME
export const VERYFI_API_KEY = process.env.VERYFI_API_KEY
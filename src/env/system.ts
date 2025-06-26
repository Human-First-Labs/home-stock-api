import { config } from 'dotenv'

config()

if (!process.env.NODE_ENV) {
    throw new Error('NODE_ENV environment variable not set')
}

export const NODE_ENV = process.env.NODE_ENV
export const PROD = process.env.NODE_ENV !== 'production'

export const PORT = process.env.PORT || 8081

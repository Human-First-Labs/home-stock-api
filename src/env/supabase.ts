import { config } from 'dotenv'

config()

if (!process.env.SB_JWT_SECRET) throw new Error('SB_JWT_SECRET variable is missing!')
export const SB_JWT_SECRET = process.env.SB_JWT_SECRET

if (!process.env.SB_PROJECT_ID) throw new Error('SB_PROJECT_ID variable is missing!')
export const SB_PROJECT_ID = process.env.SB_PROJECT_ID || ''

if (!process.env.SB_SERVICE_ROLE) throw new Error('SB_SERVICE_ROLE variable is missing!')
export const SB_SERVICE_ROLE = process.env.SB_SERVICE_ROLE || ''

export const SB_SUPABASE_URL = `https://${SB_PROJECT_ID}.supabase.co`

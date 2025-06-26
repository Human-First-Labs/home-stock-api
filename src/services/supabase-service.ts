import { PrismaClient, PhoneInfo, EmailInfo, ContactInfo } from '@prisma/client'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { SB_SUPABASE_URL, SB_SERVICE_ROLE, SB_JWT_SECRET } from '../env/supabase'
import { createClient } from '@supabase/supabase-js'

export type ISupabaseService = ReturnType<typeof SupabaseService>

export const SupabaseService = (args: { prisma: PrismaClient }) => {
    const { prisma } = args

    const supabase = createClient(SB_SUPABASE_URL, SB_SERVICE_ROLE)

    const validateSupabaseToken = async (args: { token: string }) => {
        const { token } = args

        try {
            return jwt.verify(token, SB_JWT_SECRET) as JwtPayload
        } catch (e) {
            return undefined
        }

    }

    const getOrCreateUserFromUid = async (args: {
        uid: string, phone?: PhoneInfo, email?: EmailInfo
    }) => {
        const { uid, phone, email } = args


        let user = await prisma.users.findUnique({
            where: {
                supabaseUid: uid
            }
        })

        if (!user) {
            user = await prisma.users.create({
                data: {
                    supabaseUid: uid,
                    contactInfo: {
                        phone,
                        email
                    }
                }
            })

            return {
                user
            }
        } else {

            const contactInfo: Partial<ContactInfo> = {
                ...user.contactInfo
            }

            if (phone) {
                contactInfo.phone = phone
            }

            if (email) {
                contactInfo.email = email
            }

            const updatedUser = await prisma.users.update({
                where: {
                    id: user.id
                },
                data: {
                    contactInfo
                }
            })

            const imageUrls: string[] = []

            if (updatedUser.imagePaths) {
                for (let i = 0; i < updatedUser.imagePaths.length; i++) {
                    const url = await createSignedFileUrl({
                        path: updatedUser.imagePaths[i]
                    })

                    imageUrls.push(url.signedUrl)
                }
            }

            return {
                user: {
                    ...updatedUser,
                    imageUrls
                }
            }
        }
    }

    const deleteSupabaseUser = async (args: { uid: string }) => {
        const { uid } = args

        await supabase.auth.admin.deleteUser(uid)
    }

    const base64Prep = (base64: string) => {
        return base64
            .replace('data:image/jpeg;', 'data:image/jpeg;charset=utf-8;')
            .replace(/^.+,/, '')
    }

    const uploadImage = async (args: { path: string; base64: string; nameWithExtension: string }) => {

        const { base64, nameWithExtension, path } = args

        const extension = nameWithExtension.split('.').pop()

        const preppedbase64 = base64Prep(base64)

        const myBuffer = Buffer.from(preppedbase64, 'base64')

        const { data, error } = await supabase.storage
            .from('uploads')
            .upload('/' + path + '/' + nameWithExtension, myBuffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: `image/${extension}`
            })

        if (error) {
            throw error
        }

        return data
    }

    const deleteImage = async (args: { path: string }) => {
        const { path } = args

        const { data, error } = await supabase.storage.from('uploads').remove([path])

        if (error) {
            throw error
        }

        return data
    }

    const createSignedFileUrl = async (args: { path: string }) => {
        const { path } = args

        const { data, error } = await supabase.storage.from('uploads').createSignedUrl(path, 60)

        if (error) {
            throw error
        }

        return data
    }

    const createTestUser = async () => {
        return await supabase.auth.signUp({
            email: 'maurovic.cachia@gmail.com',
            password: '123456'
        })
    }


    return {
        validateSupabaseToken,
        getOrCreateUserFromUid,
        deleteSupabaseUser,
        uploadImage,
        createSignedFileUrl,
        deleteImage,
        createTestUser
    }
}

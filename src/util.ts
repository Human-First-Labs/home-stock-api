import { PrismaClientValidationError, PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from "@prisma/client/runtime/library"
import { Response } from 'express'

export type ErrorCode = 500 | 403 | 400 | 401

export const errorCodes: {
    authentication: ErrorCode
    authorization: ErrorCode
    clientSide: ErrorCode
    serverSide: ErrorCode
} = {
    authentication: 401,
    authorization: 403,
    clientSide: 400,
    serverSide: 500
}

export interface CustomError {
    name: string
    message: string
    stack?: string
    code?: ErrorCode
}

export const customError = (message: string, status?: ErrorCode) => {
    const error = new Error(message) as CustomError
    error.code = status

    return error
}

export const parsePrismaError = (error: any) => {
    console.error(error)
    if (error instanceof PrismaClientValidationError) {
        return customError('Database Validation Error', errorCodes.serverSide)
    } else if (error instanceof PrismaClientKnownRequestError) {
        return customError(error.message, errorCodes.clientSide)
    } else if (error instanceof PrismaClientUnknownRequestError) {
        return customError(error.message, errorCodes.serverSide)
    } else {
        return error
    }
}

export const toTitleCase = (phrase: string) => {
    const spaceCleaned = phrase
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    const dashCleaned = spaceCleaned.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('-');

    return dashCleaned
};

export const sendExpressError = (res: Response, error: CustomError, defaultCode = 500) => {
    console.error(error)
    return res.status(error.code || defaultCode).send({
        error: error.message
    })
}

export interface ListPagination {
    limit: number
    page: number
    sort?: {
        [field: string]: -1 | 1
    }

}

export const generateAggregationPagination = (pagination: ListPagination) => {

    let pipelineSteps: any[] = []

    if (pagination.sort) {
        pipelineSteps.push({
            '$sort': pagination.sort
        })
    }

    pipelineSteps = pipelineSteps.concat([
        {
            '$setWindowFields': {
                output: {
                    added_total: {
                        $count: {}
                    }
                }
            },
        },
        {
            '$skip': (pagination.page - 1) * pagination.limit,
        },
        {
            '$limit': pagination.limit
        }
    ])

    return pipelineSteps

}
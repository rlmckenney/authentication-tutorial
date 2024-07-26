import { Request, Response, NextFunction } from 'express'
import { getErrorMessage } from '../utils/controller-utils.js'
import {
  InternalServerErrorException,
  ValidationException,
} from '../utils/exceptions.js'
import {
  isPostgresError,
  isZodError,
  isHttpError,
} from '../utils/type-guards.js'

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  try {
    if (isZodError(error)) {
      const issues = error.issues.map((issue) => ({
        title: 'Validation Error',
        detail: issue.message,
        status: '400',
        code: issue.code,
        source: {
          pointer: `/data/attributes/${issue.path.join('/')}`,
        },
      }))
      throw new ValidationException(issues)
    }

    if (isPostgresError(error)) {
      const detail =
        error.detail || error.hint || `Postgres error: ${error.code}`
      if (error.code === '23505') {
        const issues = [
          {
            title: 'Validation Error',
            detail,
            status: '400',
          },
        ]
        throw new ValidationException(issues)
      }
      // Otherwise return a generic 500 error
      throw new InternalServerErrorException(detail, 'Database Error')
    }

    // Rethrow if it is already an HTTPException
    if (isHttpError(error)) throw error

    // If the error is not a known type, return a generic 500 error
    throw new InternalServerErrorException(getErrorMessage(error))
  } catch (error) {
    if (isHttpError(error)) {
      return res.status(error.statusCode).json(error.toJSONAPI())
    }
    console.error('Unhandled error:', error)
    throw error
  }
}

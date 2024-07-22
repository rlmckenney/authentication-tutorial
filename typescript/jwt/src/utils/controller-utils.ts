import type { Response } from 'express'
import { isPostgresError, isError, isZodError } from './type-guards.js'

/**
 * Error handler for controller route handler methods
 * Returns a JSON response similar to JSONAPI (but needs more work to be fully compliant).
 */
export function handleError(error: unknown, res: Response) {
  if (isZodError(error)) {
    return res.status(400).json({ errors: error.issues })
  }

  if (isPostgresError(error)) {
    if (error.code === '23505') {
      return res.status(400).json({
        errors: [
          {
            title: 'Validation Error',
            message: 'That email is already registered.',
          },
        ],
      })
    }
    return res
      .status(500)
      .json({ errors: [{ title: 'Database Error', message: error.detail }] })
  }

  if (isError(error)) {
    return res
      .status(500)
      .json({ errors: [{ title: 'Server Error', message: error.message }] })
  }

  return res.status(500).json({
    errors: [
      {
        title: 'Server Error',
        message: 'Sorry, an unexpected error occured.',
      },
    ],
  })
}

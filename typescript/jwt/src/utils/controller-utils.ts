import type { Response } from 'express'
import { isPostgresError, isError } from './type-guards.js'

/**
 * Error handler for controller route handler methods
 */
export function handleError(error: unknown, res: Response) {
  if (isPostgresError(error)) {
    return res.status(400).json({ error: error.detail })
  }
  if (isError(error)) {
    return res.status(400).json({ error: error.message })
  }
  return res.status(500).json({ error: 'Sorry, an unexpected error occured.' })
}

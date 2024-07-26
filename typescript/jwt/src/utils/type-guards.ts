/**
 * Type guards
 */

import type { PostgresError } from 'postgres'
import { ZodError } from 'zod'
import { HTTPException } from './exceptions.js'

export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function isPostgresError(value: unknown): value is PostgresError {
  if (!isError(value)) return false
  return value.name === 'PostgresError'
}

export function isZodError(value: unknown): value is ZodError {
  return value instanceof ZodError
}

export function isHttpError(value: unknown): value is HTTPException {
  return value instanceof HTTPException
}

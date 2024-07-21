/**
 * Type guards
 */

import type { PostgresError } from 'postgres'

export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function isPostgresError(value: unknown): value is PostgresError {
  return value instanceof Error && value.name === 'PostgresError'
}

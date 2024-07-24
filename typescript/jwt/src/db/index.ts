import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'
import { DB } from '../config.js'

const queryClient = postgres(DB.connectionString)

export const db = drizzle(queryClient, {
  schema: { ...schema },
})

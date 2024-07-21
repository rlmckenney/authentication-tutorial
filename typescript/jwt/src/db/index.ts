import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { userSchema } from './schema.js'
import { connectionString } from './pg-url.js'

const querryClient = postgres(connectionString)

export const db = drizzle(querryClient, { schema: { ...userSchema } })

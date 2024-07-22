import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { userSchema, loginCredentialSchema } from './schema.js'
import { connectionString } from './pg-url.js'

const queryClient = postgres(connectionString)

export const db = drizzle(queryClient, {
  schema: { ...userSchema, ...loginCredentialSchema },
})

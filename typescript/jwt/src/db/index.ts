import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as usersSchema from './schema/users.js'
import { connectionString } from './pg-url.js'

const querryClient = postgres(connectionString)

export const db = drizzle(querryClient, { schema: usersSchema })

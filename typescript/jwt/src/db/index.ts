import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE } = process.env

const connectionString = `postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`

const querryClient = postgres(connectionString)

export const db = drizzle(querryClient)

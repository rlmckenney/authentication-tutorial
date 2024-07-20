import { createServer } from 'node:http'
import express from 'express'
import './load-env.js'

import { sql } from 'drizzle-orm'
import { db } from './db/index.js'

// test the db connection
console.debug('db result: ', await db.execute(sql`SELECT 1 + 1 AS result`))

/**
 * Create a simple Express router application.
 */
const app = express()
app.get('/ping', (req, res) => {
  res.send('pong')
})

/**
 * Create HTTP server.
 * HTTP server listen on provided port, on all network interfaces.
 */
const server = createServer(app)
const port = Number(process.env.API_PORT) || 3000
const host = process.env.API_HOST || '0.0.0.0'

server.listen({ port, host })

server.on('error', (err: Error) => {
  console.error(`Express failed to listen \n ${err.message} ...\n`, err.stack)
})

server.on('listening', () => {
  console.info(`Express server is listening at ${host}:${port}`)
})

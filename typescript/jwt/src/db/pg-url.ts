const host = process.env.PG_HOST || 'localhost'
const port = process.env.PG_PORT || '5432'
const user = process.env.PG_USER || 'dev_user'
const password = process.env.PG_PASSWORD || 'dev_password'
const database = process.env.PG_DATABASE || 'authentication_tutorial'

export const connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`

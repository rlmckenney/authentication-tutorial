import type { Secret, Algorithm } from 'jsonwebtoken'
import { config } from 'dotenv'
config()

export const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '15')

export const JWT = {
  secret: (process.env.JWT_SECRET || 'notSoSecret') as Secret,
  algorithm: (process.env.JWT_ALGORITHM || 'HS256') as Algorithm,
  idExpiresIn: process.env.JWT_ID_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '2d',
} as const

export const DB = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || '5432',
  user: process.env.PG_USER || 'dev_user',
  password: process.env.PG_PASSWORD || 'dev_password',
  database: process.env.PG_DATABASE || 'authentication_tutorial',
  get connectionString() {
    return `postgres://${this.user}:${this.password}@${this.host}:${this.port}/${this.database}`
  },
} as const

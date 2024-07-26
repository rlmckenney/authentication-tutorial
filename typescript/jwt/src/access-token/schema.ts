import jwt from 'jsonwebtoken'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'

import { redis } from '../db/redis.js'
import { JWT } from '../config.js'

export const jwtPayloadSchema = z.object({
  iat: z.number(),
  exp: z.number(),
  jti: z.string().uuid(),
  userId: z.string().uuid(),
  tokenType: z.enum(['access', 'refresh']),
})

export type JWTPayload = z.infer<typeof jwtPayloadSchema>

// The primary token is the still valid token in the Authorization header
// This is the second token of the accessToken/refreshToken pair
export const refreshRequestBodySchema = z.object({
  token: z.string(),
})

export function generateTokens(userId: string) {
  const jwtid = uuidv7()
  const accessToken = jwt.sign({ userId, tokenType: 'access' }, JWT.secret, {
    expiresIn: JWT.idExpiresIn,
    algorithm: JWT.algorithm,
    jwtid: jwtid,
  })
  const refreshToken = jwt.sign({ userId, tokenType: 'refresh' }, JWT.secret, {
    expiresIn: JWT.refreshExpiresIn,
    algorithm: JWT.algorithm,
    jwtid: jwtid,
  })
  return { accessToken, refreshToken }
}

export async function invalidateToken({ jti, exp }: JWTPayload) {
  const timestamp = new Date().toISOString()
  return redis.set(`revoked-jwt:${jti}`, timestamp, 'EX', exp + 60, 'NX')
}
export async function isTokenRevoked({ jti }: JWTPayload) {
  return redis.exists(`revoked-jwt:${jti}`)
}

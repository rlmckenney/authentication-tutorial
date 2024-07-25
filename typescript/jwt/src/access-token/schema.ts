import { z } from 'zod'

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

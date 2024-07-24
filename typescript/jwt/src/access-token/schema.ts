import { z } from 'zod'

export const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
})

export type JWTPayload = z.infer<typeof jwtPayloadSchema>

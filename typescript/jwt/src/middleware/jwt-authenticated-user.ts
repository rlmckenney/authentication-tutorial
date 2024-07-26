import { eq } from 'drizzle-orm'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { isTokenRevoked, jwtPayloadSchema } from '../access-token/schema.js'
import { JWT } from '../config.js'
import { db } from '../db/index.js'
import { users } from '../user/schema.js'
import { getErrorMessage } from '../utils/controller-utils.js'

export async function jwtAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Extract the token from the Authorization header
    const [authorizationType, token] =
      req.headers.authorization?.split(' ') ?? []
    if (authorizationType !== 'Bearer' || !token) {
      throw new Error('Missing or invalid Authorization header')
    }
    // Verify the token and extract the payload
    const rawPayload = jwt.verify(token, JWT.secret)
    const payload = jwtPayloadSchema.parse(rawPayload)
    // Check if the token has been revoked
    if (await isTokenRevoked(payload)) {
      throw new Error(`Token has been revoked: ${payload.jti}`)
    }
    // Check if the token type is allowed
    if (payload.tokenType === 'refresh' && !req.refreshTokenIsAllowed) {
      throw new Error(`Invalid token type: ${payload.tokenType}`)
    }
    // Load the user from the database
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    })
    if (!currentUser) {
      throw new Error(
        `Unable to get User from the database with the userId: ${payload.userId}`,
      )
    }
    // Attach the authenticated user to the request object
    req.currentUser = currentUser
    req.jwtPayload = payload
    next()
  } catch (error) {
    console.info(
      `[jwtAuthenticatedUser] JWT verification failed: ${getErrorMessage(error)}`,
    )
    res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Missing or invalid Authorization header',
        },
      ],
    })
  }
}

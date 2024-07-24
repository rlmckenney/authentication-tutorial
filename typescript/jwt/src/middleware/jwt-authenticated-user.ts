import { eq } from 'drizzle-orm'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { jwtPayloadSchema } from '../access-token/schema.js'
import { JWT } from '../config.js'
import { db } from '../db/index.js'
import { users } from '../user/schema.js'

const unauthorizedResponse = {
  errors: [
    {
      status: '401',
      title: 'Unauthorized',
      detail: 'Missing or invalid Authorization header',
    },
  ],
}

export async function jwtAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Extract the token from the Authorization header
  const [authorizationType, token] = req.headers.authorization?.split(' ') ?? []
  if (authorizationType !== 'Bearer' || !token) {
    console.info('Missing or invalid Authorization header')
    return res.status(401).json(unauthorizedResponse)
  }

  // Verify the token and extract the payload
  try {
    const payload = jwtPayloadSchema.parse(jwt.verify(token, JWT.secret))
    // Load the user from the database
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    })
    if (!currentUser) {
      console.error(
        'Unable to retrieve User from the database with the provided JWT payload',
        payload,
      )
      return res.status(401).json(unauthorizedResponse)
    }
    // Attach the authenticated user to the request object
    req.currentUser = currentUser
    next()
  } catch (error) {
    console.info('JWT verification failed:', error)
    res.status(401).json(unauthorizedResponse)
  }
}

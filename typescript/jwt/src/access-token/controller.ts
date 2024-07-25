import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { JWT, SALT_ROUNDS } from '../config.js'
import { baseSchema, loginCredentials } from '../login-credential/schema.js'
import { handleError } from '../utils/controller-utils.js'
import type { JWTPayload } from './schema.js'
import {
  generateTokens,
  jwtPayloadSchema,
  refreshRequestBodySchema,
  invalidateToken,
} from './schema.js'

const loginParamsSchema = baseSchema.pick({ loginName: true, password: true })

export async function store(req: Request, res: Response) {
  const { loginName, password } = loginParamsSchema.parse(req.body)

  // db returns undefined if not found
  const loginCredential = await db.query.loginCredentials.findFirst({
    where: eq(loginCredentials.loginName, loginName),
  })
  const badHash = `$2b$${SALT_ROUNDS}$invalidusernameaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
  const passwordHash = loginCredential?.passwordHash ?? badHash

  const passwordDidMatch = await bcrypt.compare(password, passwordHash)
  if (!loginCredential || !passwordDidMatch) {
    return res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Invalid login credentials',
        },
      ],
    })
  }

  res.json({ data: generateTokens(loginCredential.userId) })
}

export async function replace(req: Request, res: Response) {
  // Add a type narrowing condition to tell TypeScript that req.jwtPayload is
  // not undefined. If it is missing, the middleware was not correctly registered.
  if (req.jwtPayload === undefined) {
    return res.status(500).json({
      errors: [
        {
          status: '500',
          title: 'Internal Server Error',
          detail: 'Missing jwtPayload. Check middleware registration.',
        },
      ],
    })
  }
  try {
    // This is the second token of the accessToken/refreshToken pair
    // The primary token is the still valid token in the Authorization header
    const { token } = refreshRequestBodySchema.parse(req.body)
    const verifiedPayload = jwt.verify(token, JWT.secret, {
      algorithms: [JWT.algorithm],
      jwtid: req.jwtPayload.jti,
      ignoreExpiration: true,
    }) as JWTPayload
    if (verifiedPayload.userId !== req.jwtPayload.userId) {
      throw new Error('Token pair mismatch: userId')
    }
    if (verifiedPayload.tokenType === req.jwtPayload.tokenType) {
      throw new Error('Token pair mismatch: tokenType')
    }
    // TODO: invalidate the token pair using the jti claim
    res.json({ data: generateTokens(req.jwtPayload.userId) })
  } catch (error) {
    console.error('JWT verification failed:', error)
    // TODO: invalidate the token pair using the jti claim
    res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Invalid refresh token',
        },
      ],
    })
  }
}

export async function destroy(req: Request, res: Response) {
  try {
    const payload = jwtPayloadSchema.parse(req.jwtPayload)
    invalidateToken(payload)
    res.status(204).send() // No Content, successful deletion
  } catch (error) {
    handleError(error, res)
  }
}

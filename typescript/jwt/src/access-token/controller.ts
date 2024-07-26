import type { JWTPayload } from './schema.js'
import jwt from 'jsonwebtoken'
import { NextFunction, Request, Response } from 'express'

import { JWT } from '../config.js'
import {
  baseSchema,
  getUserIdWithCredentials,
} from '../login-credential/schema.js'
import {
  generateTokens,
  jwtPayloadSchema,
  refreshRequestBodySchema,
  invalidateToken,
} from './schema.js'
import { getErrorMessage } from '../utils/controller-utils.js'

const loginParamsSchema = baseSchema.pick({ loginName: true, password: true })

export async function store(req: Request, res: Response) {
  // TODO: revoke previous tokens on successful login
  try {
    const { loginName, password } = loginParamsSchema.parse(req.body)
    const userId = await getUserIdWithCredentials(loginName, password)
    res.json({ data: generateTokens(userId) })
  } catch (error) {
    console.info('Login failed:', getErrorMessage(error))
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
    res.json({ data: generateTokens(req.jwtPayload.userId) })
  } catch (error) {
    console.info('JWT verification failed:', getErrorMessage(error))
    res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Invalid refresh token',
        },
      ],
    })
  } finally {
    // Always invalidate the token pair
    await invalidateToken(req.jwtPayload)
  }
}

export async function destroy(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = jwtPayloadSchema.parse(req.jwtPayload)
    await invalidateToken(payload)
    res.status(204).send() // No Content, successful deletion
  } catch (error) {
    next(error)
  }
}

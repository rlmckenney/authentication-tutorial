import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Secret, Algorithm } from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { baseSchema, loginCredentials } from '../login-credential/schema.js'

const loginParamsSchema = baseSchema.pick({ loginName: true, password: true })
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 14
const JWT = {
  secret: (process.env.JWT_SECRET || 'notSoSecret') as Secret,
  algorithm: (process.env.JWT_ALGORITHM || 'HS256') as Algorithm,
  idExpiresIn: process.env.JWT_ID_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '2d',
} as const

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

  const jwtPayload = { userId: loginCredential.userId }

  const accessToken = jwt.sign(jwtPayload, JWT.secret, {
    expiresIn: JWT.idExpiresIn,
    algorithm: JWT.algorithm,
  })
  const refreshToken = jwt.sign(jwtPayload, JWT.secret, {
    expiresIn: JWT.refreshExpiresIn,
    algorithm: JWT.algorithm,
  })

  res.json({ data: { accessToken, refreshToken } })
}

export async function replace(req: Request, res: Response) {
  res.json({ data: 'replace' })
}

export async function destroy(req: Request, res: Response) {
  res.json({ data: 'destroy' })
}

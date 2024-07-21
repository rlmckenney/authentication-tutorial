import type { Request, Response } from 'express'
import { db } from '../db/index.js'
import { users } from './schema.js'
import { handleError } from '../utils/controller-utils.js'

export async function index(req: Request, res: Response) {
  try {
    const users = await db.query.users.findMany()
    return res.json({ data: users })
  } catch (error) {
    handleError(error, res)
  }
}
export async function store(req: Request, res: Response) {
  // add zod validation
  try {
    const user = await db.insert(users).values(req.body).returning()
    return res.json({ data: user })
  } catch (error) {
    handleError(error, res)
  }
}

export async function show(req: Request, res: Response) {
  res.json({ data: 'ok' })
}
export async function update(req: Request, res: Response) {
  res.json({ data: 'ok' })
}
export async function destroy(req: Request, res: Response) {
  res.json({ data: 'ok' })
}

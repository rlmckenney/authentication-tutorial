import type { Request, Response } from 'express'
import { db } from '../db/index.js'
import { users, insertUserSchema, selectUserSchema } from './schema.js'
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
  try {
    const params = insertUserSchema.parse(req.body)
    const results = await db.insert(users).values(params).returning()
    const data = selectUserSchema.parse(results[0])
    return res.json({ data })
  } catch (error) {
    handleError(error, res)
  }
}

export async function show(req: Request, res: Response) {
  res.json({ data: 'not implemented yet' })
}
export async function update(req: Request, res: Response) {
  res.json({ data: 'not implemented yet' })
}
export async function destroy(req: Request, res: Response) {
  res.json({ data: 'not implemented yet' })
}

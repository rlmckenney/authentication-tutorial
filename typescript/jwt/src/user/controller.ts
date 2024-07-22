import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  users,
  insertUserSchema,
  selectUserSchema,
  updateUserSchema,
  userIdSchema,
} from './schema.js'
import { handleError } from '../utils/controller-utils.js'
import { ResourceNotFoundException } from '../utils/exceptions.js'

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
  try {
    const user = await findUserById(req)
    return res.json({ data: user })
  } catch (error) {
    handleError(error, res)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = userIdSchema.parse(req.params.id)
    const params = updateUserSchema.parse(req.body)
    const result = await db
      .update(users)
      .set(params)
      .where(eq(users.id, id))
      .returning()
    if (result.length === 0) {
      throw new ResourceNotFoundException('User', `id: ${id}`)
    }
    return res.json({ data: result[0] })
  } catch (error) {
    handleError(error, res)
  }
}

export async function destroy(req: Request, res: Response) {
  try {
    const id = userIdSchema.parse(req.params.id)
    const result = await db.delete(users).where(eq(users.id, id)).returning()
    if (result.length === 0) {
      throw new ResourceNotFoundException('User', `id: ${id}`)
    }
    return res.json({ data: result[0] })
  } catch (error) {
    handleError(error, res)
  }
}

// Helper function fetch a user by id based on the request params.
async function findUserById(req: Request) {
  const id = userIdSchema.parse(req.params.id)
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  })
  if (!user) throw new ResourceNotFoundException('User', `id: ${id}`)
  return user
}

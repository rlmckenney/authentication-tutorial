import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { handleError } from '../utils/controller-utils.js'
import { ResourceNotFoundException } from '../utils/exceptions.js'
import {
  users,
  storeUserSchema,
  selectUserSchema,
  updateUserSchema,
  userIdSchema,
} from './schema.js'

export async function index(req: Request, res: Response) {
  try {
    const foundUsers = await db.query.users.findMany()
    return res.json({ data: foundUsers })
  } catch (error) {
    handleError(error, res)
  }
}

export async function store(req: Request, res: Response) {
  try {
    const params = storeUserSchema.parse(req.body)
    const insertedUsers = await db.insert(users).values(params).returning()
    return res
      .status(201)
      .json({ data: selectUserSchema.parse(insertedUsers[0]) })
  } catch (error) {
    handleError(error, res)
  }
}

export async function show(req: Request, res: Response) {
  try {
    const id = userIdSchema.parse(req.params.id)
    const foundUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    })
    if (!foundUser) throw new ResourceNotFoundException('User', `id: ${id}`)
    return res.json({ data: foundUser })
  } catch (error) {
    handleError(error, res)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = userIdSchema.parse(req.params.id)
    const params = updateUserSchema.parse(req.body)
    const updatedUsers = await db
      .update(users)
      .set(params)
      .where(eq(users.id, id))
      .returning()
    if (updatedUsers.length === 0) {
      throw new ResourceNotFoundException('User', `id: ${id}`)
    }
    return res.json({ data: updatedUsers[0] })
  } catch (error) {
    handleError(error, res)
  }
}

export async function destroy(req: Request, res: Response) {
  try {
    const id = userIdSchema.parse(req.params.id)
    const deletedUsers = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning()
    if (deletedUsers.length === 0) {
      throw new ResourceNotFoundException('User', `id: ${id}`)
    }
    return res.json({ data: deletedUsers[0] })
  } catch (error) {
    handleError(error, res)
  }
}

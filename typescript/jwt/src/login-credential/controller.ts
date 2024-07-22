import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { handleError } from '../utils/controller-utils.js'
import { ResourceNotFoundException } from '../utils/exceptions.js'
import {
  loginCredentials,
  resourceIdSchema,
  storeLoginCredentialSchema,
  updateLoginCredentialSchema,
} from './schema.js'

export async function index(req: Request, res: Response) {
  try {
    const foundCredentials = await db.query.loginCredentials.findMany()
    return res.json({ data: foundCredentials })
  } catch (error) {
    handleError(error, res)
  }
}
export async function store(req: Request, res: Response) {
  try {
    const params = await storeLoginCredentialSchema.parseAsync(req.body)
    const insertedCredential = await db
      .insert(loginCredentials)
      .values(params)
      .returning()
    return res.json({ data: insertedCredential[0] })
  } catch (error) {
    handleError(error, res)
  }
}
export async function show(req: Request, res: Response) {
  res.json({ data: 'ok' })
}
export async function update(req: Request, res: Response) {
  try {
    const id = resourceIdSchema.parse(req.params.id)
    const params = await updateLoginCredentialSchema.parseAsync(req.body)
    const updatedCredential = await db
      .update(loginCredentials)
      .set(params)
      .where(eq(loginCredentials.id, id))
      .returning()
    if (updatedCredential.length === 0) {
      throw new ResourceNotFoundException('LoginCredential', `id: ${id}`)
    }
    return res.json({ data: updatedCredential[0] })
  } catch (error) {
    handleError(error, res)
  }
}
export async function destroy(req: Request, res: Response) {
  res.json({ data: 'ok' })
}

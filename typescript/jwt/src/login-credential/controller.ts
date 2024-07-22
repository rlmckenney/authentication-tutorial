import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { handleError } from '../utils/controller-utils.js'
import { ResourceNotFoundException } from '../utils/exceptions.js'
import {
  loginCredentials,
  resourceIdSchema,
  redactedLoginCredentialSchema,
  storeLoginCredentialSchema,
  updateLoginCredentialSchema,
} from './schema.js'

export async function index(req: Request, res: Response) {
  try {
    const foundCredentials = await db.query.loginCredentials.findMany({
      columns: { passwordHash: false },
    })
    return res.json({ data: foundCredentials })
  } catch (error) {
    handleError(error, res)
  }
}

export async function store(req: Request, res: Response) {
  try {
    const params = await storeLoginCredentialSchema.parseAsync(req.body)
    const newCredential = (
      await db.insert(loginCredentials).values(params).returning()
    )[0] // There should only be one inserted credential in the array
    return res.status(201).json({
      data: redactedLoginCredentialSchema.parse(newCredential),
    })
  } catch (error) {
    handleError(error, res)
  }
}

export async function show(req: Request, res: Response) {
  try {
    const id = resourceIdSchema.parse(req.params.id)
    const foundCredential = await db.query.loginCredentials.findFirst({
      where: eq(loginCredentials.id, id),
    })
    if (!foundCredential) {
      throw new ResourceNotFoundException('LoginCredential', `id: ${id}`)
    }
    return res.json({
      data: redactedLoginCredentialSchema.parse(foundCredential),
    })
  } catch (error) {
    handleError(error, res)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = resourceIdSchema.parse(req.params.id)
    const params = await updateLoginCredentialSchema.parseAsync(req.body)
    const updatedCredential = (
      await db
        .update(loginCredentials)
        .set(params)
        .where(eq(loginCredentials.id, id))
        .returning()
    )[0]
    if (!updatedCredential) {
      throw new ResourceNotFoundException('LoginCredential', `id: ${id}`)
    }
    return res.json({
      data: redactedLoginCredentialSchema.parse(updatedCredential),
    })
  } catch (error) {
    handleError(error, res)
  }
}

export async function destroy(req: Request, res: Response) {
  try {
    const id = resourceIdSchema.parse(req.params.id)
    const deletedCredential = (
      await db
        .delete(loginCredentials)
        .where(eq(loginCredentials.id, id))
        .returning()
    )[0]
    if (!deletedCredential) {
      throw new ResourceNotFoundException('LoginCredentials', `id: ${id}`)
    }
    return res.json({
      data: redactedLoginCredentialSchema.parse(deletedCredential),
    })
  } catch (error) {
    handleError(error, res)
  }
}

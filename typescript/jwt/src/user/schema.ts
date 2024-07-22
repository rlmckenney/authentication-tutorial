import { relations } from 'drizzle-orm'
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { loginCredentials } from '../login-credential/schema.js'

export const users = pgTable('users', {
  id: uuid('id').$defaultFn(uuidv7).primaryKey(),
  firstName: varchar('first_name', { length: 256 }).notNull(),
  lastName: varchar('last_name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).unique().notNull(),
  createdAt: timestamp('created_at', {
    mode: 'date',
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdate(
    () => new Date(),
  ),
})

export const usersRelations = relations(users, ({ one }) => ({
  loginCredentials: one(loginCredentials),
}))

// Schema for inserting a user - can be used to validate API requests
export const storeUserSchema = createInsertSchema(users, {
  firstName: z.string().trim().min(1).max(256),
  lastName: z.string().trim().min(1).max(256),
  email: z.string().trim().toLowerCase().email().max(256),
}).pick({
  firstName: true,
  lastName: true,
  email: true,
})

export const updateUserSchema = storeUserSchema.partial()

// Schema for selecting a user - can be used to validate API responses
// optionally Omit createdAt and updatedAt fields from the response
// by calling selectUserSchema.parse(result) in the controller method.
export const selectUserSchema = createSelectSchema(users).omit({
  createdAt: true,
  updatedAt: true,
})

// Schema for parsing input params when selecting a user by ID
export const userIdSchema = z.string().uuid()

import { relations } from 'drizzle-orm'
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

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

export const loginCredentials = pgTable('login_credentials', {
  id: uuid('id').$defaultFn(uuidv7).primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' })
    .notNull(),
  loginName: varchar('login_name', { length: 256 }).unique().notNull(),
  passwordHash: varchar('password', { length: 256 }).notNull(),
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

export const loginCredentialsRelations = relations(
  loginCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [loginCredentials.userId],
      references: [users.id],
    }),
  }),
)

// Schema for inserting a user - can be used to validate API requests
export const insertUserSchema = createInsertSchema(users, {
  firstName: z.string().trim().min(1).max(256),
  lastName: z.string().trim().min(1).max(256),
  email: z.string().trim().toLowerCase().email().max(256),
}).pick({
  firstName: true,
  lastName: true,
  email: true,
})

// Schema for selecting a user - can be used to validate API responses
// optionallyoOmit createdAt and updatedAt fields from the response
// by calling selectUserSchema.parse(result) in the controller method.
export const selectUserSchema = createSelectSchema(users).omit({
  createdAt: true,
  updatedAt: true,
})

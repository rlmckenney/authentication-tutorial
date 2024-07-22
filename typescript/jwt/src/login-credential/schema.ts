import { relations } from 'drizzle-orm'
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { createInsertSchema } from 'drizzle-zod'
import { users } from '../user/schema.js'

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 12

export const loginCredentials = pgTable('login_credentials', {
  id: uuid('id').$defaultFn(uuidv7).primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' })
    .notNull(),
  loginName: varchar('login_name', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', {
    mode: 'date',
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdate(
    () => new Date(),
  ),
})

export const loginCredentialsRelations = relations(
  loginCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [loginCredentials.userId],
      references: [users.id],
    }),
  }),
)

/**
 * When validating input params, it is customary to have the user submit a
 * password and a confirmation password. This is because the password is
 * often obscured and the user may not be able to see what they are typing.
 *
 * Using Zod's refine method, we can compare the password and confirmation
 * password to ensure they match. If they do not match, we can return an error.
 * If they do match, we can safely return the parsed the data excluding the
 * no longer needed confirmation field.
 *
 * This is a common pattern when working with forms in web applications and
 * should be applied to both the store and update methods.
 *
 * Using Zod's transform method, we can automatically hash the
 * validated password. The controller can then use the parsed data to
 * update the database.
 */

const baseSchema = z.object({
  userId: z.string().uuid(),
  loginName: z.string().trim().min(6).max(254),
  password: z.string().trim().min(8).max(254),
  passwordConfirm: z.string().trim(),
})

const partialBaseSchema = baseSchema.partial()

const refinedSchema = partialBaseSchema.refine((data) => {
  return data.password === data.passwordConfirm
})

function confirmPassword(data: z.infer<typeof partialBaseSchema>) {
  return refinedSchema.safeParse(data).success
}
const confirmPasswordError = {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}

// Define the type for the SQL insert statement
const insertSchema = createInsertSchema(loginCredentials)
type TableSchema = z.infer<typeof insertSchema>
type InsertSchema = Pick<TableSchema, 'userId' | 'loginName' | 'passwordHash'>

// Schema for validating input params when creating a new login credential
export const storeLoginCredentialSchema = baseSchema
  .refine(confirmPassword, confirmPasswordError)
  .transform(async (data) => {
    const parsedCredential: InsertSchema = {
      userId: data.userId,
      loginName: data.loginName,
      passwordHash: await bcrypt.hash(data.password!, SALT_ROUNDS),
    }
    return parsedCredential
  })

type UpdateSchema = Pick<InsertSchema, 'passwordHash'>
// Schema for validating input params when updating a new login credential
export const updateLoginCredentialSchema = baseSchema
  .pick({ password: true, passwordConfirm: true })
  .refine(confirmPassword, confirmPasswordError)
  .transform(async (data) => {
    const parsedCredential: UpdateSchema = {
      passwordHash: await bcrypt.hash(data.password!, SALT_ROUNDS),
    }
    return parsedCredential
  })

// Schema for parsing input params when selecting a LoginCredential by ID
export const resourceIdSchema = z.string().uuid()

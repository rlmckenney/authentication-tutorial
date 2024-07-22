# Handling JWTs in TypeScript

## 4. Create the LoginCredential entity resources

In step 3 you created the router and controller modules for a standard RESTful CRUD API for managing User resources. Now let's quickly do the same for LoginCredentials. That will complete our base project prerequisites and then in Step 5 we can begin to look at working with JSON Web Tokens (JWT).

Some people would choose to mix handling the User and their related LoginCredentials together. However, because the architectural plan for this project needs future flexibility (potentially multiple credentials for a given user), we are building independent resource API endpoints. You can choose to combine them in your application's user interface (UI) workflow, but the API calls will be separate.

This resource will largely follow the same pattern as the User modules, so we can go a bit quicker this time.

### 4.1 Create the `/login-credentials` router

Create a new `src/login-credential/router.ts` file with this code:

```typescript
import { Router } from 'express'
import * as controller from './controller.js'

export const loginCredentialRouter = Router()

// Base URI: /api/login-credentials -- set in server.ts
loginCredentialRouter.route('/').get(controller.index).post(controller.store)

loginCredentialRouter
  .route('/:id')
  .get(controller.show)
  .patch(controller.update)
  .delete(controller.destroy)
```

Register this router in the `server.ts` file.

```typescript
import { loginCredentialRouter } from './user/router.js'
// ... other routes
app.use('/api/login-credentials', loginCredentialRouter)
```

## 4.2 Create the `/login-credentials` controller methods

### 4.2.1 Stub out the base controller methods

Create a new file `src/login-credential/controller.ts` and add the following code to stub out the methods that you referenced in the router:

```typescript
import type { Request, Response } from 'express'

export async function index(req: Request, res: Response) {
  res.json({ data: 'ok' })
}
export async function store(req: Request, res: Response) {
  res.json({ data: 'ok' })
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
```

Check that everything is wired up correctly. Start your dev server, if it is not already running with: `pnpm dev`. Then check each route with `curl` or `Postman`.

```bash
# index
curl http://localhost:3000/api/login-credentials
# show
curl http://localhost:3000/api/login-credentials/1
# store
curl -X POST http://localhost:3000/api/login-credentials
# update
curl -X PATCH http://localhost:3000/api/login-credentials/1
# destroy
curl -X DELETE http://localhost:3000/api/login-credentials/1
```

Each of these should return a JSON response with `{ data: 'ok' }`.

### 4.2.1 Create a schema module for LoginCredentials

The `src/user/schema.ts` file currently has definitions for User and LoginCredential. Let's split them up.

Add a new schema module for LoginCredentials in `src/login-credential/schema.ts` and copy over:

- the `loginCredentials` table definition
- the `loginCredentialsRelations` definition
- the dependency imports

Add a new import for the `users` table from the User schema module. Your file should now look like this:

```typescript
import { relations } from 'drizzle-orm'
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import { users } from '../user/schema.js'

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
```

#### Zod schema validators

Like with the User schema, we will use Zod to validate the data that comes in from the API. This time we will use more features of Zod to do custom validation and data transformation before sending it to the database. Let's build it up step by step.

The base schema includes the `loginName` and `userId` fields from the table definition above, plus `password` and `confirmPassword` fields. This is a common pattern for user registration forms. The confirmPassword field is not stored in the database, but is used to validate that the user has entered the same password twice. The password field is the plain text password that will be hashed before storing in the database.

```typescript
const baseSchema = z.object({
  userId: z.string().uuid(),
  loginName: z.string().trim().min(6).max(254),
  password: z.string().trim().min(8).max(254),
  confirmPassword: z.string().trim(),
})
```

Using Zod's `.refine()` method, you can compare the password and confirmation password to ensure they match. If they do not match, you can return an error. If they do match, you can safely return the parsed the data excluding the no longer needed confirmation field. However, the refine method returns a modified schema that does not support the `.pick()` or `.omit()` methods, so you need to assign it to an intermediate variable.

```typescript
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
```

OK, now put it all together to create the `storeLoginCredentialsSchema` and the `updateLoginCredentialsSchema` that you will use in the corresponding controller methods.

```typescript
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
```

### 4.2.2 Hash the password before returning after validation

> [!IMPORTANT]
> Notice the `.transform()` method in the `storeLoginCredentialSchema` and `updateLoginCredentialSchema`. This is where you hash the password before storing it in the database. In each case, the final returned object is safe to pass into the database query.

You need to install the [bcrypt](https://www.npmjs.com/package/bcrypt) library in your project. It is a widely used library for hashing passwords with implementations in most popular programming languages. You can read more about how it works from this Wikipedia article: [bcrypt](https://en.wikipedia.org/wiki/Bcrypt).

```bash
pnpm add bcrypt
pnpm add --save-dev @types/bcrypt
```

Import it into the controller module and set the number of salt rounds to use when hashing the password. The higher the number, the longer it takes to generate. The algorithm is designed to be slow to make it harder for attackers to brute force the password hash. For more details on how this works, see [A Note on Rounds](https://www.npmjs.com/package/bcrypt#a-note-on-rounds).

The default number of rounds is 10, but you can increase it to 13 or 15 for production.
I like to use 14, which should be about 1.5 seconds to generate a hash. You probably want to inject this value from an environment variable, so you can adjust it to your runtime environment without modifying the code.

```typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 14
```

### 4.2.3 Refactor the User schema module

### 4.2.4 Update the db schema imports

You need to add the new table schema to the database connection. Update the master `db/schema.ts` file:

```typescript
export * as loginCredentialSchema from '../login-credential/schema.js'
```

Then update the `db/index.ts` file to include the new schema:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { userSchema, loginCredentialSchema } from './schema.js'
import { connectionString } from './pg-url.js'

const queryClient = postgres(connectionString)

export const db = drizzle(queryClient, {
  schema: { ...userSchema, ...loginCredentialSchema },
})
```

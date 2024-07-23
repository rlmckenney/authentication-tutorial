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

Now put it all together to create the `storeLoginCredentialsSchema` and the `updateLoginCredentialsSchema` that you will use in the corresponding controller methods.

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

There's a lot happening here! Let's break it down:

1. Each of the exported validation schemas start with the `baseSchema` where all form fields are required. The `updateLoginCredentialsSchema` then applies the `pick()` method to narrow the validation to just the `password` and `passwordConfirm` fields.

2. After the validation rules from the `baseSchema` have been checked, the Zod `refine()` method is called on the resulting schema object. It takes two arguments. The first is a validation function that returns a boolean. The second is an object with Zod error properties.

3. Because you will need to call this from both the `store` and `update` controller methods, the `partialBaseSchema` is created to allow for any of the fields to be optional by the time it reaches the `refinedSchema`. Don't worry the required fields are checked in the `baseSchema` validation _before_ the `refine()` method is called.

4. The `confirmPassword` function is a wrapper around the refinedSchema validator that does the actual comparison to ensure the passwords match. The `confirmPasswordError` object defines the parameters to merge into the Zod error object if the comparison fails.

It seems like a lot of work, but this is a very powerful feature of Zod that allows you to create complex validation rules that are not easily expressed in a simple schema definition. It allows you to:

- locate the validation (business) rules with the object definitions,
- consistently apply the same validation rules across multiple controller methods,
- and return the correct types for the parsed data.

### 4.2.2 Hash the password before returning after validation

> [!IMPORTANT]
> Notice the `.transform()` method in the `storeLoginCredentialSchema` and `updateLoginCredentialSchema`. This is where you hash the password before storing it in the database. In each case, the final returned object is safe to pass directly into the database query.

You need to install the [bcrypt](https://www.npmjs.com/package/bcrypt) library in your project. It is a widely used library for hashing passwords with implementations in most popular programming languages. You can read more about how it works from this Wikipedia article: [bcrypt](https://en.wikipedia.org/wiki/Bcrypt).

```bash
pnpm add bcrypt
pnpm add --save-dev @types/bcrypt
```

Import it into the controller module and set the number of salt rounds to use when hashing the password. The higher the number, the longer it takes to generate. The algorithm is designed to be slow to make it harder for attackers to brute force the password hash. For more details on how this works, see [A Note on Rounds](https://www.npmjs.com/package/bcrypt#a-note-on-rounds).

The default number of rounds is 10, but you can increase it to between 13 and 15 for production.
I like to use 14, which should be about 1.5 seconds to generate a hash. You probably want to inject this value from an environment variable, so that you can adjust it to the compute power of your runtime environment without modifying the code.

```typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 14
```

#### How does that transform work?

The `transform()` method is a powerful feature of Zod that allows you to modify the data before it is returned from the validation process. This is useful when you need to do some data transformation before storing it in the database. In this case, you are hashing the password before storing it in the database.

The `transform()` method takes a function that receives the parsed (validated) data and returns the transformed data. The function can be synchronous or asynchronous. Asynchronous in this case, since you to `await` the hash method of the `bcrypt` library.

> [!IMPORTANT]
> You are responsible for the content and the shape (type) of the data that is returned from the `transform()` method. **This is powerful, but use it carefully.**
> Notice that the code defines two different types for the `InsertSchema` and `UpdateSchema` objects. This is because the `store` method needs the `userId`, `loginName`, and `passwordHash` fields, while the `update` method only needs to send the `passwordHash` to the database.

### 4.2.3 Refactor the User schema module

- remove the `loginCredentials` and `loginCredentialsRelations` definitions
- import the `loginCredentials` table definition from the new schema module
- update the `insertUserSchema` to be `storeUserSchema` to keep the naming consistent
- update the imports and usage of `insertUserSchema` in the user/controller to reflect the new name

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

### 4.2.5 Implement the `index` controller method

This largely follows the same pattern as the User controller.

```typescript
export async function index(req: Request, res: Response) {
  try {
    const foundCredentials = await db.query.loginCredentials.findMany()
    return res.json({ data: foundCredentials })
  } catch (error) {
    handleError(error, res)
  }
}
```

> [!TIP]
> That will work for now, but most production apps will need to add pagination and filtering options to this method. We will cover that in a future step.

> [!WARNING]
> The current implementation returns all of the hashed passwords. YIKES!
> Let's fix that right now.

You can use the Drizzle `columns` option on the `findMany` method to exclude the passwordHash field from the returned data. This method modifies the SQL query, the sensitive data is never fetched from the database, and the data does not need to be filtered in the application code.

````typescript
    const foundCredentials = await db.query.loginCredentials.findMany({
      columns: { passwordHash: false },
    })
    ```
````

### 4.2.6 Implement the `store` controller method

This method will parse the client supplied data, applying the validation rules from the `storeLoginCredentialSchema`, including hashing the password.

The parsed params are now safe to insert into the database. If any field does not pass validation, an error will be thrown and caught by the `handleError` function.

```typescript
export async function store(req: Request, res: Response) {
  try {
    const params = await storeLoginCredentialSchema.parseAsync(req.body)
    const newCredential = (
      await db.insert(loginCredentials).values(params).returning()
    )[0] // Postgres returns an array of inserted rows, even if only one row is inserted
    return res.status(201).json({ data: newCredential })
  } catch (error) {
    handleError(error, res)
  }
}
```

> [!TIP]
> It is standard practice to return a `201 Created` status code when a new resource is created. Without the `res.status(201)` method, the default status `200` would be sent.

Again you need to redact the passwordHash field from the returned data. Unfortunately, the `.returning()` method does not have the same `columns` API as used above. This means you can manually specify all of the returned fields, excluding the passwordHash field (and repeat this for the show, update, and destroy methods).

```typescript
  .returning({
        id: loginCredentials.id,
        userId: loginCredentials.userId,
        loginName: loginCredentials.loginName,
      })
```

**OR,** a better option is to use a `drizzle-zod` helper function to create another Zod schema for validating the returned data before sending it back to the client. This is a good practice to ensure that the data you are sending back is compliant with your API contract.

In the `src/login-credential/schema.ts` file, add a new schema for the returned data:

```typescript
// Schema for redacting the passwordHash field when returning a LoginCredential
export const redactedLoginCredentialSchema = createSelectSchema(
  loginCredentials,
).omit({ passwordHash: true })
```

Then in the controller, you can use this schema to validate the returned data. Don't forget to import it at the top of the controller file.

```typescript
export async function store(req: Request, res: Response) {
  try {
    const params = await storeLoginCredentialSchema.parseAsync(req.body)
    const newCredential = (
      await db.insert(loginCredentials).values(params).returning()
    )[0] // Postgres returns an array of inserted rows, even if only one row is inserted
    return res.status(201).json({
      data: redactedLoginCredentialSchema.parse(newCredential),
    })
  } catch (error) {
    handleError(error, res)
  }
}
```

### 4.2.7 Implement the `show` controller method

```typescript
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
```

### 4.2.8 Implement the `update` controller method

```typescript
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
```

### 4.2.9 Implement the `destroy` controller method

```typescript
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
```

OK. That's it for the LoginCredential resource. You should now have a working API for managing LoginCredentials. You can test it with `curl` or `Postman` to ensure that everything is working as expected. And don't forget to commit your changes to your git repository.

> [!TIP]
> If your project is not working as expected and you need some help finding the problem, you can always refer to the `typescript-jwt-step-4` branch of this repo to see a working example.

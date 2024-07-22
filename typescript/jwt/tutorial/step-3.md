# Handling JWTs in TypeScript

## 3. Create the User entity resources

You are creating a RESTful API to manage users. The URI path will be `/users`. Your client application will likely have a form to register new users, update user information, and look up users by their username or email. Those will be the operations you will implement in this step.

You will need to define the standard route matching the RESTful API pattern.
You will need corresponding route handler methods to handle the requests, including data validation, database queries and returning responses.

We are starting to add more complexity to the application. It is time to organize the code a bit better. Some people favour grouping code by type -- all the routes in one folder, all the controllers in another, etc. If that is how your team likes to work, by all means do that.

I prefer to group code by domain entity. In this case, we are working with the `User` entity. So, I will create a folder called `src/user` and put all of components that deal with the `User` entity in that folder. This will include the schema, the router, and the controller.

```bash
mkdir src/user
```

## 3.1 Create the `/users` router

Create a minimal router for the `/users` route, following the standard RESTful API pattern.

Create a new file `src/user/router.ts` and add the following code:

```typescript
import { Router } from 'express'
import * as controller from './controller.js'

export const userRouter = Router()

// Base URI: /api/users -- set in server.ts
userRouter.route('/').get(controller.index).post(controller.store)

userRouter
  .route('/:id')
  .get(controller.show)
  .patch(controller.update)
  .delete(controller.destroy)
```

This router needs to be registered in the main `server.ts` file. Add the following line to the `server.ts` file:

```typescript
import { userRouter } from './user/router.js'
// ...
app.use(express.json())
app.use('/api/users', userRouter) // this sets the base URI for the userRouter
```

Notice the dependency on the `controller` module. You will need to create this module next.

## 3.2 Create the `/users` controller methods

### 3.2.1 Create the initial stub for the controller

Create a new file `src/user/controller.ts` and add the following code to stub out the methods that you referenced in the router:

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

> [!NOTE]
> For a web-application, you would typically have a `/register` route with a registration form that collects the user's information and sends it to the server. A mobile app will have a similar mechanism. For this tutorial, we will focus only on the RESTful API that those apps will communicate with.
> Feel free to add a registration form on your own, if you like. Otherwise, you can use a tool like `curl` or `Postman` to send HTTP requests to the server.

### 3.2.2 Test the `/users` route

OK. Start the server and test the `/users` route using `curl` or `Postman`.

```bash
pnpm dev
```

```bash
# In a new terminal window
curl http://localhost:3000/api/users
```

You should see the response `{"data":"ok"}`.

### 3.2.3 Find all users

The `index` method will be used to find all users. You will need to import the `db` ORM client and call the `findMany()` method on `users`.

```typescript
import type { Request, Response } from 'express'
import { db } from '../db/index.js'

export async function index(req: Request, res: Response) {
  const users = await db.user.findMany()
  res.json({ data: users })
}

// ...rest of the methods
```

Test that out with `curl` or `Postman`. This time the response should be an empty array `{"data":[]}`. This makes sense because we haven't added any users to the database yet.

> [!NOTE]
> This is only the happy path. We will need to add error handling and validation to these methods. We will do that in a few steps coming up.

### 3.2.4 Create a new user

The `store` method will be used to create a new user. You will need to import the `users` schema and call the `insert(users)` method on `db`, with the values coming from the `req.body`.

```typescript
// ... other imports
import { users } from '../db/schema/users.js'

export async function store(req: Request, res: Response) {
  const user = await db.insert(users).values(req.body).returning()
  return res.json({ data: user })
}
```

> [!TIP]
> The `returning()` method returns the complete record as inserted into the database. This is useful if you need to know the ID of the record that was just inserted, or want to return the complete record to the client. This does not work natively with MySQL. Check the Drizzle docs for a workaround.

Test that out with `curl` or `Postman`. Remember this needs to be a POST request.

```bash
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"firstName": "Ada", "lastName": "Lovelace", "email": "ada.lovelace@example.com"}'
```

You should see the response similar to:

```json
{
  "data": [
    {
      "id": "0190d6e7-14ea-77de-9f7d-799dd208bf96",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "email": "ada.lovelace@example.com",
      "createdAt": "2024-07-21T20:06:26.802Z",
      "updatedAt": "2024-07-21T20:06:26.799Z"
    }
  ]
}
```

Notice that the `id`, `createdAt`, and `updatedAt` fields are automatically generated by the schema. The `id` is a UUID, and the `createdAt` and `updatedAt` are timestamps. The timestamps are defaulted to UTC time. You can change this behaviour in the schema if you like.

> [!TIP]
> It is a good idea to make a git commit after each successful step. This way, if you make a mistake, you can easily revert to the last working state.

### 3.2.5 Add simple error handling

Every time you interact with the database, there is a chance that something could go wrong. Let's some add error handling to the `store` method. Start by adding a try-catch block around the `insert` method.

```typescript
export async function store(req: Request, res: Response) {
  try {
    const user = await db.insert(users).values(req.body).returning()
    return res.json({ data: user })
  } catch (error) {
    console.error(error)
    return res
      .status(500)
      .json({ error: 'An error occurred while creating the user' })
  }
}
```

Test that out with `curl` or `Postman`. You can test this by sending a POST request with an empty body.

```bash
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{}'
```

You should see the response `{"error":"An error occurred while creating the user"}`. That's a good start but it could be more informative. What kind of error occurred? Let's add some more specific error handling.

### 3.2.6 Add more specific error handling

A standard TypeScript error object has a `message` property that you can use to get more information about the error. You can use this to provide a more specific error message to the client.

BUT, in TypeScript you can throw almost anything. So, you can't rely on the `message` property to get the error message. You need a [type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards) to check if the value thrown is in fact an `Error` object.

```typescript
function isError(value: unknown): value is Error {
  return value instanceof Error
}
```

Now you can use this type guard to check if the value thrown is an `Error` object. If it is, you can use the `message` property to get the error message.

```typescript
// ...
} catch (error) {
  console.error(error)
  if (isError(error)) {
    return res.status(400).json({ error: error.message })
  }
  return res.status(500).json({ error: 'An error occurred while creating the user' })
}
```

Similarly, any error coming from the database will be a `PostgresError`. You can check the error code to determine the type of error that occurred. For example, if the email is not unique, you will get a `23505` error code. You can use this to provide a more specific error message to the client. It also has a `description` property that you can use to get more information about the error.

Create a type guard for `PostgresError`:

```typescript
function isPostgresError(value: unknown): value is PostgresError {
  return value instanceof Error && value.name === 'PostgresError'
}
```

And update the catch block to handle the `PostgresError`:

```typescript
} catch (error) {
  console.error(error)
  if (isPostgresError(error)) {
    return res.status(400).json({ error: error.detail })
  }
  if (isError(error)) {
    return res.status(400).json({ error: error.message })
  }
  return res.status(500).json({ error: 'An error occurred while creating the user' })
}
```

Now you are providing the most relevant detail based on the actual error that occurred. Test it out with `curl` or `Postman`. See what you get.

### 3.2.7 Refactor the error handling

You are going to need to add error handling to all the methods. It would be a good idea to refactor the error handling into a separate function. This way, you can reuse the error handling logic in all the methods. In fact it will be useful in other controllers as well, so lets extract it into a separate file.

The type guards will be useful in other controllers as well, let's also extract them into a separate file.

Create a new `src/utils` directory and add a new file called `type-guards.ts`:

```typescript
/**
 * Type guards
 */

import type { PostgresError } from 'postgres'

export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function isPostgresError(value: unknown): value is PostgresError {
  return value instanceof Error && value.name === 'PostgresError'
}
```

In the `src/utils` directory and add a new file called `controller-utils.ts`:

```typescript
import type { Response } from 'express'
import { isPostgresError, isError } from './type-guards.js'
/**
 * Error handler for controller route handler methods
 */
export function handleError(error: unknown, res: Response) {
  if (isPostgresError(error)) {
    if (error.code === '23505') {
      return res.status(400).json({
        errors: [
          {
            title: 'Validation Error',
            message: 'That email is already registered.',
          },
        ],
      })
    }
    return res
      .status(500)
      .json({ errors: [{ title: 'Database Error', message: error.detail }] })
  }

  if (isError(error)) {
    return res
      .status(500)
      .json({ errors: [{ title: 'Server Error', message: error.message }] })
  }

  return res.status(500).json({
    errors: [
      {
        title: 'Server Error',
        message: 'Sorry, an unexpected error occurred.',
      },
    ],
  })
}
```

Now you can refactor the `store` method to use the `handleError` function:

```typescript
import { handleError } from '../utils/controller-utils.js'
// ...
export async function store(req: Request, res: Response) {
  try {
    const user = await db.insert(users).values(req.body).returning()
    return res.json({ data: user })
  } catch (error) {
    handleError(error, res)
  }
}
```

Now you can refactor the other methods to use the `handleError` function as well.

### 3.2.8 Refactor the users schema

Since we are on a little code clean-up spree, let's refactor the users schema as well. Move the `src/db/schema/users.ts` file to `src/user/schema.ts` to collocate it with the other user related files.

Update the import references in:

- `src/user/controller.ts`
- `src/db/index.ts`

Anticipating that you will have more than one schema, let's replace the `scr/db/schema` folder with a `src/db/schema.ts` file that re-exports all the schemas from their domain entity folders.

Create a new `src/db/schema.ts` file:

```typescript
export * as userSchema from '../user/schema.js'
```

And then update the import references in `src/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { userSchema } from './schema.js'
import { connectionString } from './pg-url.js'

const queryClient = postgres(connectionString)

export const db = drizzle(queryClient, { schema: { ...userSchema } })
```

> [!TIP]
> You can use the `...` spread operator to merge multiple imported schemas into a single object.

### 3.2.9 Parse the request body with Zod

Rule number one when building APIs: never trust the client. Always validate the data coming from the client. You can use a library like [Zod](https://zod.dev/) to provide runtime type checking and validation for your data. There is a handy [Zod plugin for Drizzle](https://orm.drizzle.team/docs/zod).

First, install Zod:

```bash
pnpm add zod drizzle-zod
```

Then, update the `src/user/schema.ts` file to use Zod:

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// Schema for inserting a user - can be used to validate API requests
export const insertUserSchema = createInsertSchema(users)

// Schema for selecting a user - can be used to validate API responses
export const selectUserSchema = createSelectSchema(users)
```

You can enhance the `insertUserSchema` with more validation rules by passing an options object as the second parameter. Let's require the `email` field to conform to an email address format and normalize it to lowercase. It is also a good idea to trim leading and trailing whitespace from all `string` fields.

```typescript
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().trim().toLowerCase().email().max(256),
})
```

Let's apply some min/max size constraints to the name fields.

```typescript
export const insertUserSchema = createInsertSchema(users, {
  firstName: z.string().trim().min(1).max(256),
  lastName: z.string().trim().min(1).max(256),
  email: z.string().trim().toLowerCase().email().max(256),
})
```

Zod also provides pick and omit methods to select or exclude fields from the schema. You can use these methods to limit the fields that can be inserted or returned.

```typescript
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
export const selectUserSchema = createSelectSchema(users).omit({
  createdAt: true,
  updatedAt: true,
})
```

Now you can use the `insertUserSchema` to validate the request body in the `store` method:

```typescript
// update the import statement
import { users, insertUserSchema, selectUserSchema } from './schema.js'
// ...
export async function store(req: Request, res: Response) {
  try {
    const params = insertUserSchema.parse(req.body)
    const results = await db.insert(users).values(params).returning()
    // optionally apply the selectUserSchema to filter the results
    // return a single user object not an array
    const data = selectUserSchema.parse(results[0])
    return res.json({ data })
  } catch (error) {
    handleError(error, res)
  }
}
```

You now have a new source of validation errors that can be thrown by the `parse` method. Let's update the error handling utilities.

Start with a new type guard for Zod errors:

```typescript
import { ZodError } from 'zod'

export function isZodError(value: unknown): value is ZodError {
  return value instanceof ZodError
}
```

Then update the `handleError` function to handle Zod errors:

```typescript
import { isPostgresError, isError, isZodError } from './type-guards.js'

export function handleError(error: unknown, res: Response) {
  if (isZodError(error)) {
    return res
      .status(400)
      .json({ errors: error.issues })
  }
 // ... rest of the function

```

### 3.2.10 Complete the other CRUD methods

OK, now that you have the `store` method refactored, you can apply the same pattern to the other CRUD methods. For the sake of time, I will provide the final code for the `show`, `update`, and `destroy` methods below.

First define a zod schema for the `user.id` parameter. Add this line to the botton of the `src/user/schema.ts` file and then import it in the `controller.ts` file.

```typescript
// Schema for parsing input params when selecting a user by ID
export const userIdSchema = z.string().uuid()
```

Each of the following methods will use the `userIdSchema` to parse the `id` parameter from the request params and then try to retrieve the user from the database. Rather than repeating the same validation and lookup logic in each method, you can create a helper function to handle the common logic.

Add the following helper function to the botton of the `src/user/controller.ts` file:

```typescript
// Helper function fetch a user by id based on the request params.
async function findUserById(req: Request) {
  const id = userIdSchema.parse(req.params.id)
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  })
  if (!user) throw new ResourceNotFoundException('User', `id: ${id}`)
  return user
}
```

> [!IMPORTANT]
> The `ResourceNotFoundException` is a custom error class that you will need to define in the `src/utils/exceptions.ts` file. You will also need a new type guard for this error class in the `src/utils/type-guards.ts` file, and update the `handleError` function to handle this new error type.

<details>
<summary>src/utils/exceptions.ts</summary>

```typescript
export class HTTPException extends Error {
  public statusCode: number
  public status: string

  constructor(statusCode: number, status: string, message: string) {
    super(message) // Call the constructor of the base Error class
    this.statusCode = statusCode
    this.status = status

    // Set the prototype explicitly (needed when extending built-in classes)
    Object.setPrototypeOf(this, HTTPException.prototype)

    // Maintain proper stack trace (only in V8 environments like Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ResourceNotFoundException extends HTTPException {
  constructor(resource: string, query: string) {
    const message = `${resource} not found with ${query}`
    super(404, 'Resource Not Found', message)

    // Set the prototype explicitly
    Object.setPrototypeOf(this, ResourceNotFoundException.prototype)
  }
}
```

</details>

<details>
<summary>src/utils/type-guards.ts</summary>

```typescript
export function isHttpError(value: unknown): value is HTTPException {
  return value instanceof HTTPException
}
```

</details>

<details>
<summary>src/utils/controller-utils.ts</summary>

```typescript
if (isHttpError(error)) {
  return res
    .status(error.statusCode)
    .json({ errors: [{ title: error.status, message: error.message }] })
}
```

</details>

### 3.2.11 Implement the show, update, and destroy methods

<details>
<summary>user/controller.show</summary>

```typescript
export async function show(req: Request, res: Response) {
  try {
    const user = await findUserById(req)
    return res.json({ data: user })
  } catch (error) {
    handleError(error, res)
  }
}
```

</details>

<details>
<summary>user/controller.update</summary>

Drizzle's `update` API matches the underlying SQL UPDATE statement. This allows you to set only the fields that have new values. This fits well with the PATCH method in RESTful APIs, which allows clients to send partial resource representations to update only the fields that have changed.

You will want a new Zod schema to validate the request body for the `update` method. Add the following schema to the `src/user/schema.ts` file:

```typescript
export const updateUserSchema = insertUserSchema.partial()
```

This schema is similar to the `insertUserSchema`, but it allows for partial objects. This means that the client can send only the fields that need to be updated, rather than the entire user object.

Import that in the `src/user/controller.ts` file and implement the `update` method:

```typescript
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
```

</details>

<details>
<summary>user/controller.destroy</summary>

```typescript
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
```

> [!NOTE]
> The `destroy` method returns the deleted user object in the response. This is a common pattern in RESTful APIs. The client can use the response to confirm that the resource was deleted successfully.

This method could be simplified by using the `findUserById` helper function. However, that would have required two database calls. This version only makes one call to the database. The trade-off is that the error handling is a bit more verbose in exchange for better performance.

</details>

### 3.2.12 Clean up the user controller

> [!TIP]
> We fell into the trap of premature abstraction. Now that we have fleshed out the implementation for all of the CRUD methods, it turns out that the `findUserById` helper function is only used in one place.
> It is a better practice wait until you find yourself repeating the same code in multiple places before you abstract it into a helper function. Sorry, I led you astray! (kind of on purpose, but still!)

OK. Lets get rid of the `findUserById` helper function and refactor the `show` method to use the `db.query.users.findFirst` method directly.

Then let look for any other opportunities to clean up the code.

There is some inconsistency in the variable names used to store the result of the database queries. Result(s) is OK, but generic. This controller is dealing with Users, and the database queries are all returning arrays of Users. Let's use more descriptive variable names related to the action, i.e. `deletedUsers`, `updatedUsers`, `insertedUsers`, or `foundUsers`.

<details>
<summary>Complete /src/user/controller.ts</summary>

```typescript
import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { handleError } from '../utils/controller-utils.js'
import { ResourceNotFoundException } from '../utils/exceptions.js'
import {
  users,
  insertUserSchema,
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
    const params = insertUserSchema.parse(req.body)
    const insertedUsers = await db.insert(users).values(params).returning()
    return res.json({ data: selectUserSchema.parse(insertedUsers[0]) })
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
```

</details>

# Handling JWTs in TypeScript

## 8. Logout and Revoke a JWT pair

There is one more step to complete the authentication lifecycle: logging out and revoking the JWT pair. This will prevent the token from being used to access any protected resources.

There are four typical trigger events for invalidating a token:

1. The user logs out.
2. The user changes their password. This usually refreshes the token.
3. The token has been refreshed before it expires.
4. An administrator forces a logout.

#### What does it mean to invalidate the token?

It means that the token is added to a deny-list. When a token is presented to the server, it is checked against the deny-list. If the token is found, the server responds with a 401 Unauthorized status code.

Because this will happen on every request, it is recommended to use a fast in-memory store like Redis to store the invalidated tokens. Redis also has the ability to set an expiration time on the deny-list entries, so it can automatically remove them after the token's expiry time. This ensures that the deny-list doesn't grow indefinitely, which keeps memory utilization reasonable and improves look-up speed.

> [!IMPORTANT]
> Tokens should never be stored in your database. This would pose a similar risk to storing plain text passwords. So, the deny-list will store only the token id. This has the added advantage of reducing the memory footprint of the deny-list.

### 8.1 Implement the `destroy` method in the `access-token/controller`

When the client application handles a `logout` event, it should call the `destroy` method in the `access-token/controller`. The `destroy` method will add the token to the deny-list.

For safety, not just anyone can call the `destroy` method. The client application must present a valid JWT to the server. The router middleware has been set to accept either an access token or a refresh token in the Authorization header, as long as it is valid.

By the time the request gets to the destroy method, you know the token is valid. You can use the `req.jwtPayload.jti` property to get the token id.

```typescript
export async function destroy(req: Request, res: Response) {
  try {
    const payload = jwtPayloadSchema.parse(req.jwtPayload)
    await invalidateToken(payload)
    res.status(204).send() // No Content, successful deletion
  } catch (error) {
    handleError(error, res)
  }
}
```

### 8.2 Implement the `invalidateToken` function

Now create that `invalidateToken` function. This function will add the token id to the deny-list in Redis. Create the deny-list as a Set in Redis. It is highly performant with add, delete, and lookup operations all running in O(1) time complexity.

Install the [ioredis](https://www.npmjs.com/package/ioredis) package:

```bash
pnpm add ioredis
```

The `ioredis` client will use localhost and port 6379 by default. This will be fine for initial development steps. But let's add the configuration variables to the `src/config` module so that it is ready for other environments.

```typescript
export const REDIS = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  username: process.env.REDIS_USERNAME || '', // needs Redis >= 6
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
} as const
```

Create a new file in the `db` folder called `redis.ts` to manage the Redis connection. Import the `REDIS` configuration object and initialize the new Redis client:

```typescript
import { Redis } from 'ioredis'
import { REDIS } from '../config.js'
export const redis = new Redis(REDIS)
```

Import the utils errorHandler, redis client and update the schema imports in the `access-token/controller`:

```typescript
import { redis } from '../db/redis.js'
import {
  type JWTPayload,
  jwtPayloadSchema,
  refreshRequestBodySchema,
} from './schema.js'
import { handleError } from '../utils/controller-utils.js'
```

Add two new helper functions at the bottom of the `access-token/controller`:

```typescript
async function invalidateToken({ jti, exp }: JWTPayload) {
  const timestamp = new Date().toISOString()
  return redis.set(`revoked-jwt:${jti}`, timestamp, 'EX', exp + 60, 'NX')
}
async function isTokenRevoked({ jti }: JWTPayload) {
  return redis.exists(`revoked-jwt:${jti}`)
}
```

The `invalidateToken` function uses the `redis.set` method to create key:value pairs.
The key is the token id prefixed with `revoked-jwt:`. This will namespace the deny-list keys and make it easier to manage alongside other Redis keys.

Use the token id as the key (with the prefix) with an expiration time of the token's expiry time plus 60 seconds. This ensures that the token is automatically removed from the deny-list after the token expires. The value is set to the current time to help with debugging, but it could be anything. The key is what is important.

The `NX` option tells Redis to only set the key if it does not already exist. This is a safety measure to prevent accidentally overwriting an existing key.

The `isTokenRevoked` function checks if the token id is in the deny-list. If it is, the function returns `true`.

### 8.3 Update the `jwtAuthenticatedUser` middleware

Now update the `jwtAuthenticatedUser` middleware to check if the token is revoked before allowing access to the protected route.

You will need the `isTokenRevoked` function, which depends on the Redis client. Let's reduce the dependencies in multiple modules by moving the `isTokenRevoked` and the `invalidateToken` functions to the `access-token/schema.ts` (model).

Then import the `invalidateToken` function in the `access-token/controller`.

And, import the `isTokenRevoked` function in the `jwtAuthenticatedUser` middleware:

```typescript
import { isTokenRevoked, jwtPayloadSchema } from '../access-token/schema.js'
// ... right after parsing the payload
if (await isTokenRevoked(payload)) {
  console.info('Token has been revoked:', payload.jti)
  return res.status(401).json(unauthorizedResponse)
}
// before checking if the refresh token is allowed.
```

All the error handling repetition is starting to bother me. Let's clean that up a bit.
Every error case (so far) is returning a 401 status code, but logging a more helpful message for you to use in debugging. You can just throw an error with the message you want to log, and the error handler will take care of the rest.

```typescript
// e.g.
console.info('Invalid token type:', payload.tokenType)
return res.status(401).json(unauthorizedResponse)
// becomes
throw new Error(`Invalid token type: ${payload.tokenType}`)
```

Then in the catch block, console log the error message and return the error response:

```typescript
} catch (error) {
    if (error instanceof Error) {
      console.info(
        `[jwtAuthenticatedUser] JWT verification failed: ${error.message}`,
      )
    } else {
      console.warn('[jwtAuthenticatedUser] Unknown error:', error)
    }
    res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Missing or invalid Authorization header',
        },
      ],
    })
  }
```

> [!NOTE]
> The `instanceof` type guard check is necessary because the `error` could be anything. If it is not an instance of `Error`, then it is not safe to call `error.message`.

<details>
<summary>The complete refactored `jwtAuthenticatedUser` middleware</summary>

```typescript
import { eq } from 'drizzle-orm'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { isTokenRevoked, jwtPayloadSchema } from '../access-token/schema.js'
import { JWT } from '../config.js'
import { db } from '../db/index.js'
import { users } from '../user/schema.js'

export async function jwtAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Extract the token from the Authorization header
    const [authorizationType, token] =
      req.headers.authorization?.split(' ') ?? []
    if (authorizationType !== 'Bearer' || !token) {
      throw new Error('Missing or invalid Authorization header')
    }
    // Verify the token and extract the payload
    const rawPayload = jwt.verify(token, JWT.secret)
    const payload = jwtPayloadSchema.parse(rawPayload)
    // Check if the token has been revoked
    if (await isTokenRevoked(payload)) {
      throw new Error(`Token has been revoked: ${payload.jti}`)
    }
    // Check if the token type is allowed
    if (payload.tokenType === 'refresh' && !req.refreshTokenIsAllowed) {
      throw new Error(`Invalid token type: ${payload.tokenType}`)
    }
    // Load the user from the database
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    })
    if (!currentUser) {
      throw new Error(
        `Unable to get User from the database with the userId: ${payload.userId}`,
      )
    }
    // Attach the authenticated user to the request object
    req.currentUser = currentUser
    req.jwtPayload = payload
    next()
  } catch (error) {
    if (error instanceof Error) {
      console.info(
        `[jwtAuthenticatedUser] JWT verification failed: ${error.message}`,
      )
    } else {
      console.warn('[jwtAuthenticatedUser] Unknown error:', error)
    }
    res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Missing or invalid Authorization header',
        },
      ],
    })
  }
}
```

</details>

### 8.4 Test the logout functionality

Using `curl` or Postman, send a `DELETE` request to the `/api/access-tokens` endpoint with the JWT in the Authorization header. The server should respond with a `204 No Content` success status code.

```bash
curl -X DELETE http://localhost:3000/api/access-tokens \
  -w "%{http_code}\n" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJ0b2tlblR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3MjE5Mzc4ODEsImV4cCI6MTcyMTkzODc4MSwianRpIjoiMDE5MGViN2UtZThjYi03YmJmLWIzYzAtNWMwN2ZkNTBkNzUzIn0.AnZokBz-z5iiTAS26Xmud7Ql7hcdpUYyu711GW7oVMw"
# expected result:
204
```

You can visually verify that the token has been added to the deny-list by checking the Redis database with TablePlus or another Redis client.

### 8.5 Invalidate the old token on refresh.

When the client application refreshes the token, the old token should be invalidated. There are two comments in the `access-token/controller` that hint at where to add this logic. It should be if the refresh token is valid and if it is not valid. If it is invalid, it is possible that the token has been compromised, and you should invalidate it.

You can cover both cases by adding a `finally` block that calls the `invalidateToken` function with the JWT payload. This will ensure that the token is invalidated regardless of the outcome of the refresh operation.

```typescript
} finally {
    // Always invalidate the token pair
    await invalidateToken(req.jwtPayload)
  }
```

### 8.6 Refactor to better separate concerns

Move the `generateTokens` function to the `access-token/schema.ts`. This will consolidate all the token-management logic in one place.

> [!TIP]
> Don't forget to clean-up unused imports after moving things around.

Some of the logic for handling hashed passwords has leaked into the `access-token/controller`. The module with primary responsibility for this is the `login-credential/schema`. Let's extract the password validation logic to the `login-credential/schema` and update the `access-token/controller` to use the new function.

```typescript
/** login-credential/schema.ts */
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'

// ...

export async function getUserIdWithCredentials(
  loginName: string,
  password: string,
) {
  // db returns undefined if not found
  const loginCredential = await db.query.loginCredentials.findFirst({
    where: eq(loginCredentials.loginName, loginName),
  })
  const badHash = `$2b$${SALT_ROUNDS}$invalidusernameaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
  const passwordHash = loginCredential?.passwordHash ?? badHash

  const passwordsDidMatch = await bcrypt.compare(password, passwordHash)
  if (!loginCredential || !passwordsDidMatch) {
    throw new Error('Invalid login credentials')
  }
  return loginCredential.userId
}
```

In the `access-token/controller`, import the new `getUserIdWithCredentials` function and refactor the `store` method to use it. Remove the now unused imports: bcrypt, eq, db, SALTS_ROUNDS, and loginCredentials.

```typescript
/** access-token/controller.ts */

export async function store(req: Request, res: Response) {
  try {
    const { loginName, password } = loginParamsSchema.parse(req.body)
    const { userId } = await validateCredentials(loginName, password)
    res.json({ data: generateTokens(userId) })
  } catch (error) {
    console.info('Login failed:', error)
    return res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Invalid login credentials',
        },
      ],
    })
  }
}
```

> [!TIP]
> As a general guideline, restrict handling of sensitive data to the smallest possible scope. This will help to reduce the risk of it accidentally leaking. With this refactor, the `access-token/controller` never directly handles the password hash. The `login-credential/schema` has no access to the Response object and cannot accidentally leak any sensitive data.

### 8.7 Improve the error handling

There is some inconsistency in how errors are being handled. In particular there is the awkward type checking dance in several places because in TypeScript (JavaScript) you can throw anything. This is a common pattern in JavaScript, but it is not idiomatic in TypeScript.

So, TypeScript rightly says that an `error` passed into a catch block is of type `unkonwn`, which makes sense. But, it is not very helpful. You can't call any methods on it, because TypeScript doesn't know what it is. So, you have to check if it is an instance of `Error` before you can do anything with it.

### 8.7.1 Create a reusable error message function

I am going to borrow a function from Kent C. Dodds that will always give you a usable error message (string) that you can log. This will make the error handling code much cleaner.

Put this in the `utils/controller-utils.ts` file.

```typescript
/**
 * Get a human-readable error message from an error
 * CREDIT: Kent C. Dodds
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
```

Now examine each of the places where you are logging an error message. If there seems to be awkward handling or the message is too generic, update it to use the new `getErrorMessage` function.

e.g. The catch block in `access-token/controller.replace` currently logs the whole error object. This makes the logs harder to read and debug. It can be updated to use the `getErrorMessage` function.

```typescript
} catch (error) {
    console.info('JWT verification failed:', getErrorMessage(error))
    return res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Invalid login credentials',
        },
      ],
    })
  }
```

The same can be done in the `store` method.

```typescript
console.info('Login failed:', getErrorMessage(error))
```

The `login-credential/controller` methods don't log any error messages. This could be fine, but if you want more observability, you can add some logging.

e.g. in the `index` method:

```typescript
console.info(`[login-credential/controller.index] ${getErrorMessage(error)}`)
```

Add a similar line to each method, updating the prefix with the method name.

There is one in the `jwt-authenticated-user` middleware. Update it to use the `getErrorMessage` function.

```typescript
// it currently looks like this ...
if (error instanceof Error) {
  console.info(
    `[jwtAuthenticatedUser] JWT verification failed: ${error.message}`,
  )
} else {
  console.warn('[jwtAuthenticatedUser] Unknown error:', error)
}

// ... it should look like this
console.info(
  `[jwtAuthenticatedUser] JWT verification failed: ${getErrorMessage(error)}`,
)
```

### 8.7.2 Refactor the `handleError` function into a middleware

That is an improvement, but there is more you can do.

The `handleError` function is a good candidate for a middleware. It is a common pattern to have a middleware that catches errors and sends a response. This will help to keep the controller methods clean and focused on the happy path.

The function signature for an Express error handler middleware function is `(err, req, res, next)`.

Create a new file in the `middleware` folder called `error-handler.ts`. This file will contain the new middleware function. Start by implementing the fallback "unknown server error" case.

```typescript
import { Request, Response, NextFunction } from 'express'
import { getErrorMessage } from '../utils/controller-utils.js'
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  res.status(500).json(formatServerError(error))
}

function formatServerError(error: unknown) {
  const message = getErrorMessage(error)
  return return {
    errors: [
      {
        status: '500',
        title: 'Server error',
        detail: message,
      },
    ],
  }
}
```

The `formatServerError` function is a helper function that creates a standard error response object following the JSONAPI spec. This will make it easier to maintain a consistent error response format across the application.

Import the type guards and then copy the first three conditional blocks from the `utils/controller-utils.ts` file into the `error-handler.ts` file. The fourth block can be ignored, as it duplicates the fallback case that is already handled.

```typescript
if (isZodError(error)) {
  return res.status(400).json({ errors: error.issues })
}

if (isPostgresError(error)) {
  if (error.code === '23505') {
    console.debug('Postgres error:', error)
    return res.status(400).json({
      errors: [
        {
          title: 'Validation Error',
          detail: error.detail,
        },
      ],
    })
  }
  return res
    .status(500)
    .json({ errors: [{ title: 'Database Error', detail: error.detail }] })
}

if (isHttpError(error)) {
  return res
    .status(error.statusCode)
    .json({ errors: [{ title: error.status, detail: error.message }] })
}
```

#### Register the error handler middleware

Import the new middleware function in the `server.ts` file and register it as the last middleware in the chain -- after all other route handlers. This ensures that it will catch any errors that are not handled by other middleware.

```typescript
import { errorHandler } from './middleware/error-handler.js'

// ... all other routes

app.use(errorHandler)
```

#### Update the controller methods to throw errors

Replace every call to the old `handleError` function with a `next(error)` call. This will pass the error to the error handler middleware.

> [!TIP]
> You will need to update the method arguments to include the `next` function. All route handlers in Express are actually just another middleware function. Now you know.

e.g. the `index` method in the `login-credential/controller` should look like this:

```typescript
export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const foundCredentials = await db.query.loginCredentials.findMany({
      columns: { passwordHash: false },
    })
    return res.json({ data: foundCredentials })
  } catch (error) {
    console.info(
      `[login-credential/controller.index] ${getErrorMessage(error)}`,
    )
    next(error)
  }
}
```

OK, test it out. Send a register user request with and invalid email address. The server should respond with a 400 status code and the same error message as before.

```bash
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Minnie","lastName": "Mouse","email": "bad-email"}' \
  | jq

# expected result:
{
  "errors": [
    {
      "validation": "email",
      "code": "invalid_string",
      "message": "Invalid email",
      "path": [
        "email"
      ]
    }
  ]
}
```

Now you can safely remove the `handleError` function from the `utils/controller-utils.ts` file. It is no longer needed.

### 8.7.3 Refactor the `error-handler` middleware

There is still more refactoring to do. Hang in there! It will be worth it.

#### HTTP errors

OK, it looks like there are a couple of places that return an HTTP 500 error. Let's add a new `InternalServerErrorException` class to the `utils/exceptions.ts` module, and then update the `formatServerError` function to handle be more generic and handle any HTTP error.

```typescript
// utils/exceptions.ts
export class InternalServerErrorException extends HTTPException {
  constructor(message: string, title: string = 'Internal Server Error') {
    super(500, title, message)

    // Set the prototype explicitly
    Object.setPrototypeOf(this, InternalServerErrorException.prototype)
  }
}
```

```typescript
// middleware/error-handler.ts
import {
  HTTPException,
  InternalServerErrorException,
} from '../utils/exceptions.js'

// ... all other code

  if (isHttpError(error)) {
    return res.status(error.statusCode).json(formatHTTPError(error))
  }

  // If the error is not a known type, return a generic 500 error
  const internalServerError = new InternalServerErrorException(
    getErrorMessage(error),
  )
  res.status(500).json(formatHTTPError(internalServerError))
}

function formatHTTPError(error: HTTPException) {
  return {
    errors: [
      {
        status: String(error.statusCode),
        title: error.status,
        detail: error.message,
      },
    ],
  }
}
```

That is better, but a little clunky still. Why not make the `HTTPException` class responsible for formatting of the error response? Add a new method to the `HTTPException` class that returns the JSONAPI error response object.

```typescript
  toJSONAPI() {
    return {
      errors: [
        {
          status: String(this.statusCode),
          title: this.status,
          detail: this.message,
        },
      ],
    }
  }
```

Then update the `error-handler` middleware to use this new method.

```typescript
// ...
  if (isHttpError(error)) {
    return res.status(error.statusCode).json(error.toJSONAPI())
  }

  // If the error is not a known type, return a generic 500 error
  const internalServerError = new InternalServerErrorException(
    getErrorMessage(error),
  )
  res.status(500).json(internalServerError.toJSONAPI())
}
```

#### Postgres Errors

The new `InternalServerErrorException` class takes an optional `title` argument. Use this to refactor the unknown database error case to be more robust in the `error-handler` middleware.

```typescript
// If the error is a Postgres error but not a known validation error,
// return a generic 500 error
const message = error.detail || error.hint || `Postgres error: ${error.code}`
const serverError = new InternalServerErrorException(message, 'Database Error')
return res.status(serverError.statusCode).json(serverError.toJSONAPI())
```

Next, give a similar treatment to the "unique constraint violation" case. Create a new `ValidationException` class in the `utils/exceptions.ts` module.

```typescript
interface JSONAPIError {
  title: string
  detail: string
  status?: string
  code?: string
  source?: {
    pointer?: string
    parameter?: string
    header?: string
  }
  meta?: Record<string, string | number | boolean>
}

export class ValidationException extends HTTPException {
  constructor(public issues: JSONAPIError[]) {
    super(400, 'Validation Error', 'One or more validation errors occurred')
    this.issues = issues

    // Set the prototype explicitly
    Object.setPrototypeOf(this, ValidationException.prototype)
  }

  override toJSONAPI() {
    return {
      errors: this.issues,
    }
  }
}
```

And update the root HTTPException class implementation of the `toJSONAPI` method to maintain type consistency.

```typescript
  toJSONAPI() {
    const errors: JSONAPIError[] = [
      {
        status: String(this.statusCode),
        title: this.status,
        detail: this.message,
      },
    ]
    return { errors }
  }
```

Now back to the `error-handler` middleware.

```typescript
if (isPostgresError(error)) {
  const detail = error.detail || error.hint || `Postgres error: ${error.code}`
  if (error.code === '23505') {
    const issues = [
      {
        title: 'Validation Error',
        detail,
        status: '400',
      },
    ]
    const validationError = new ValidationException(issues)
    return res
      .status(validationError.statusCode)
      .json(validationError.toJSONAPI())
  }
  // Otherwise return a generic 500 error
  const serverError = new InternalServerErrorException(detail, 'Database Error')
  return res.status(serverError.statusCode).json(serverError.toJSONAPI())
}
```

#### Zod Errors

You are doing great! Now, let's update handling of Zod errors to use the `ValidationException` class.

```typescript
if (isZodError(error)) {
  console.debug('Zod error:', error)
  const issues = error.issues.map((issue) => ({
    title: 'Validation Error',
    detail: issue.message,
    status: '400',
    code: issue.code,
    source: {
      pointer: `/data/attributes/${issue.path.join('/')}`,
    },
  }))
  const validationError = new ValidationException(issues)
  return res
    .status(validationError.statusCode)
    .json(validationError.toJSONAPI())
  }
}
```

Almost done. There is still some unnecessary repetition of sending the error response in the `error-handler` middleware. Let's move that into a catch block and have all of the other conditional blocks throw their HTTPException. I think that reads better.

Here is the final version of the `error-handler` middleware:

```typescript
import { Request, Response, NextFunction } from 'express'
import { getErrorMessage } from '../utils/controller-utils.js'
import {
  InternalServerErrorException,
  ValidationException,
} from '../utils/exceptions.js'
import {
  isPostgresError,
  isZodError,
  isHttpError,
} from '../utils/type-guards.js'

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  try {
    if (isZodError(error)) {
      const issues = error.issues.map((issue) => ({
        title: 'Validation Error',
        detail: issue.message,
        status: '400',
        code: issue.code,
        source: {
          pointer: `/data/attributes/${issue.path.join('/')}`,
        },
      }))
      throw new ValidationException(issues)
    }

    if (isPostgresError(error)) {
      const detail =
        error.detail || error.hint || `Postgres error: ${error.code}`
      if (error.code === '23505') {
        const issues = [
          {
            title: 'Validation Error',
            detail,
            status: '400',
          },
        ]
        throw new ValidationException(issues)
      }
      // Otherwise return a generic 500 error
      throw new InternalServerErrorException(detail, 'Database Error')
    }

    // Rethrow if it is already an HTTPException
    if (isHttpError(error)) throw error

    // If the error is not a known type, return a generic 500 error
    throw new InternalServerErrorException(getErrorMessage(error))
  } catch (error) {
    if (isHttpError(error)) {
      return res.status(error.statusCode).json(error.toJSONAPI())
    }
    console.error('Unhandled error:', error)
    throw error
  }
}
```

### Check your work

Hopefully, you were testing as you went along. If not, now is a good time to test everything again. Make sure that the error responses are consistent and that the error messages are helpful.

e.g. Send a `POST` request to the `/api/users` endpoint with an invalid email address. The server should respond with a 400 status code and a JSONAPI error response object.

```bash
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Minnie","lastName": "Mouse","email": "bad-email"}' \
  | jq

# expected result:
{
  "errors": [
    {
      "title": "Validation Error",
      "detail": "Invalid email",
      "status": "400",
      "source": {
        "pointer": "/data/attributes/email"
      }
    }
  ]
}
```

Send a `POST` request to the `/api/users` endpoint with an invalid email address. The server should respond with a 400 status code and a JSONAPI error response object.

```bash
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Mickey","lastName": "Mouse","email": "mickey.mouse@example.com"}' \
| jq

{
  "errors": [
    {
      "title": "Validation Error",
      "detail": "Key (email)=(mickey.mouse@example.com) already exists.",
      "status": "400"
    }
  ]
}
```

Send a `POST` request to the `/api/login-credentials` endpoint. With a duplicate `userName`. The server should respond with a 400 status code and a JSONAPI error response object.

Send a `POST` request to the `/api/login-credentials` endpoint with missing parameters. The server should respond with a 400 status code and a JSONAPI error response with multiple error objects.

```bash
curl -s -X POST http://localhost:3000/api/login-credentials \
  -H "Content-Type: application/json" \
  -d '{"loginName": "mickey.mouse@example.com","password": "password"}' \
| jq

{
  "errors": [
    {
      "title": "Validation Error",
      "detail": "Required",
      "status": "400",
      "code": "invalid_type",
      "source": {
        "pointer": "/data/attributes/userId"
      }
    },
    {
      "title": "Validation Error",
      "detail": "Required",
      "status": "400",
      "code": "invalid_type",
      "source": {
        "pointer": "/data/attributes/passwordConfirm"
      }
    }
  ]
}
```

Great! Now the error handling is much cleaner and more consistent across the application.

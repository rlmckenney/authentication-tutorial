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
    invalidateToken(payload)
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

Create a new file in the `db` folder called `redis.ts` to manage the Redis connection:

```typescript
import { Redis } from 'ioredis'
export const redis = new Redis()
```

The connection configuration is set with default localhost and port 6379. This will be fine for initial development steps. We will revisit this configuration in a little bit.

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
  return redis.set(`revoked-jwt:${jti}`, 'revoked', 'EX', exp + 60) // add 60 seconds
}
async function isTokenRevoked({ jti }: JWTPayload) {
  return redis.exists(`revoked-jwt:${jti}`)
}
```

The `invalidateToken` function adds the token id to the deny-list with an expiration time of the token's expiry time plus 60 seconds. This ensures that the token is removed from the deny-list after the token expires.

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

### 8.4 Refactor to better separate concerns

Move the `generateTokens` function to the `access-token/schema.ts`. This will consolidate all the token-management logic in one place.

> [!TIP]
> Don't forget to clean-up unused imports after moving things around.

### ?.? Refactor to encapsulate the login/logout logic

`SALT_ROUNDS` was only being used in the `access-token/controller` to create the `badHash` constant. What if you make the `login-credential` model (schema) responsible for creating the `badHash` constant?

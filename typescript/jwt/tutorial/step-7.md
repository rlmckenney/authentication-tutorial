# Handling JWTs in TypeScript

## 7. Refresh a JWT token pair

One of the choices you have to make when working with JWTs is how long they should be valid. If you make them too short, users will be logged out too frequently. If you make them too long, the risk of a stolen token being used by an attacker increases. One way to balance these concerns is to use short-lived tokens and refresh them periodically.

In this step, you will implement a mechanism to refresh a JWT using a refresh token. The refresh token will be a separate token that is stored on the client side and used to request a new JWT. The refresh token will have a longer expiration time than the JWT and will be used to mitigate the risk of token theft.

How much longer should the refresh token be valid than the JWT? This is a trade-off between security and usability and should be driven by the unique needs of your application and the user experience you want to provide. A helpful question is to ask yourself, "How long should my users to stay logged in without having to re-enter their credentials?"

The answer might be 1 hour, 1 day, or even 1 week. The key is to find a balance that works for your application and your users.

The example in this tutorial will use a 15 minute access token expiration time and a 2 day refresh token expiration time.

> [!IMPORTANT]
> This means that as long as the user is actively using the application, it will automatically refresh the access token every 15 minutes. If the user is inactive for more than 2 days, they will be required to log in again.

**The typical request/response flow will be:**

1. The client will send a request to some `/api/protected-resource` endpoint with the expired JWT.
2. The server will check the JWT and find that it is expired.
3. The server will respond with an HTTP 401 status code.
4. The client will then send an PUT request to the `/api/access-tokens` endpoint with the refresh token in the `Authorization` header, and the expired access token in the JSON body of the request.
5. The server will validate the refresh token
   5.1 If the refresh token is invalid, the server will respond with an HTTP 401 status code and the client will be required to log in again.
6. The server will confirm that the access token has expired.
   6.1 If the access token has not yet expired, it will be invalidated.
7. The server will invalidate the old refresh token.
8. The server will return a new access token and refresh token to the client.

> [!TIP]
> We will cover how to invalidate the old tokens in the Section 8.

### 7.1 Register the authentication middleware in the `access-token/router`

A token refresh is a request to _replace_ the current tokens. The client will send a PUT request to `/api/access-tokens` and it will be handled by the `replace` method in the `access-token/controller`.

This will be a guarded route that requires a valid token. In most cases, this will be the refresh token because the client's primary access token has expired. However, the client could also use a valid access token to refresh itself before it expires. Either way, the client will need to provide two tokens and both will be invalidated before new ones are issued.

You need to import the `jwtAuthenticatedUser` middleware in the `access-token/router.ts` file.

The current stub implementation has a route group for `/:id`. That does not make sense for this use case. You should remove add the middleware inline for the PUT and DELETE matchers. The new `access-token/router.ts` file should look like this:

```typescript
import { Router } from 'express'
import * as controller from './controller.js'
import { jwtAuthenticatedUser } from '../middleware/jwt-authenticated-user.js'

export const accessTokenRouter = Router()

// Base URI: /api/access-tokens -- set in server.ts
accessTokenRouter
  .post('/', controller.store)
  .put('/', jwtAuthenticatedUser, controller.replace)
  .delete('/', jwtAuthenticatedUser, controller.destroy)
```

> [!NOTE]
> I know the `controller.store` method name seems a little odd in this case, because we are not actually storing anything. However, the store method is responsible for creating the new access token and refresh token pair. It is a common convention to use the store method for creating new resources.
> You can of course rename the method to something more to your liking if you prefer. I kept it as `store` for consistency with the other resource controllers.

### 7.2 Implement the `replace` method in the `access-token/controller`

Let's plan it out with some pseudocode:

```typescript
export async function replace(req: Request, res: Response) {
  // check if the payload token matches the Authorization header token
  // if not, return 401
  // check if the token has expired
  // if not, invalidate it
  // invalidate the Authorization header token
  // create a new accessToken
  // create a new refreshToken
  res.json({ data: { accessToken, refreshToken } })
}
```

### 7.2.1 Make the Authorization header token available on the request object

It seems like you are going to need access to the valid token passed in the `Authorization` header. You could parse it out again in the route handler. But maybe it would be simpler to attach the decoded payload to the request object from the middleware.

The change to `jwtAuthenticatedUser` middleware will look like this:

```typescript
// ... all earlier code
req.currentUser = currentUser
req.jwtPayload = payload
next()
```

Of course you will need to add the `accessToken` property to the `Request` interface in the `express` module. You can do that in the `types/express.d.ts` file:

```typescript
import type { User } from '../user/schema.js'
import { JWTPayload } from '../access-token/schema.js'

declare global {
  namespace Express {
    interface Request {
      currentUser?: User
      jwtPayload?: JWTPayload
    }
  }
}
```

Finally, update the JWTPayload type in the `access-token/schema.ts` file:

```typescript
import { z } from 'zod'

export const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
  jti: z.string().uuid(),
})

export type JWTPayload = z.infer<typeof jwtPayloadSchema>
```

And add a validation schema for the JSON body of the PUT request in the `access-token/schema.ts` file:

```typescript
export const refreshRequestBodySchema = z.object({
  token: z.string(),
})
```

### 7.2.2 Verify that the two provided tokens match

The accessToken and the refreshToken are issued as a pair. They must match in order to be considered a valid pair. This will prevent an attacker from being able to get a new valid pair with only one compromised token.

OK, how can you verify that the two tokens match? Add an additional claim to the JWT payload that is unique to the pair. For example, this could be a UUID or crypto generated random number. Let's use the UUID method.

In your `access-tokens/controller` module, import the `uuidv7` library and add the `jwtid` claim to both tokens in the `store` method:

```typescript
import { uuidv7 } from 'uuidv7'
// ... all earlier code
const jwtPayload = { userId: loginCredential.userId }
const jwtid = uuidv7()

const accessToken = jwt.sign(jwtPayload, JWT.secret, {
  expiresIn: JWT.idExpiresIn,
  algorithm: JWT.algorithm,
  jwtid: jwtid,
})
const refreshToken = jwt.sign(jwtPayload, JWT.secret, {
  expiresIn: JWT.refreshExpiresIn,
  algorithm: JWT.algorithm,
  jwtid: jwtid,
})
```

To verify the second token, take the `req.jwtPayload.jti` claim value from the first token that was processes by the middleware and pass it as the `jwtid` option value in the `jwt.verify` method. This will throw an error if they do not match, or if the token has been tampered with.

> [!IMPORTANT]
> When decoding the token from the JSON body, it is expected to be expired. So you need to use the `jwt.verify` method with the `ignoreExpiration` option set to `true`.

> [!TIP]
> There is some confusing naming inconsistency with the jsonwebtoken library. The `jwtid` _option_ is used to set the `jti` _claim_ in the token. The `jwt.verify` method uses the `jwtid` option to match the `jti` claim in the token. This is a common source of confusion, so be careful to keep the two straight.

As a second security check, compare the `userId` claim in each token. They should also match.

If no errors are thrown, you can proceed with the token replacement. Otherwise, return an HTTP 401 status code.

```typescript
import { type JWTPayload, refreshRequestBodySchema } from './schema.js'
// ... all earlier code

export async function replace(req: Request, res: Response) {
  try {
    // The primary token is the still valid token in the Authorization header
    // This is the second token of the accessToken/refreshToken pair
    const token = refreshRequestBodySchema.parse(req.body).token
    const payload = jwt.verify(token, JWT.secret, {
      algorithms: [JWT.algorithm],
      jwtid: req.jwtPayload?.jti,
      ignoreExpiration: true,
    }) as JWTPayload
    if (payload.userId !== req.jwtPayload?.userId) {
      throw new Error('Token pair mismatch: userId')
    }
    // TODO: invalidate the token pair using the jti claim
    // create a new accessToken
    // create a new refreshToken
    res.json({ data: 'replace' })
  } catch (error) {
    console.error('JWT verification failed:', error)
    // TODO: invalidate the token pair using the jti claim
    res.status(401).json({
      errors: [
        {
          status: '401',
          title: 'Unauthorized',
          detail: 'Invalid refresh token',
        },
      ],
    })
  }
}
```

> [!TIP]
> Notice that when accessing the `req.jwtPayload` property, you need to use the optional chaining operator `?.`. This is because the property is defined as optional in the `Request` interface. You could optionally add a type guard to check if the property is defined before using it. If it is not defined, that means the middleware failed to attach the payload to the request object and you should check that the middleware is correctly registered in the `access-token/router.ts` file.

```typescript
export async function replace(req: Request, res: Response) {
  // Add a type narrowing condition to tell TypeScript that req.jwtPayload is
  // not undefined. If it is missing, the middleware was not correctly registered.
  if (req.jwtPayload === undefined) {
    return res.status(500).json({
      errors: [
        {
          status: '500',
          title: 'Internal Server Error',
          detail: 'Missing jwtPayload. Check middleware registration.',
        },
      ],
    })
  }
  try { // ... rest of the code
```

That is looking good. Now you need to generate new tokens. Extract the token generation logic from the `store` method into a separate helper function.

```typescript
function generateTokens(userId: string) {
  const jwtid = uuidv7()
  const payload = { userId }
  const accessToken = jwt.sign(payload, JWT.secret, {
    expiresIn: JWT.idExpiresIn,
    algorithm: JWT.algorithm,
    jwtid: jwtid,
  })
  const refreshToken = jwt.sign(payload, JWT.secret, {
    expiresIn: JWT.refreshExpiresIn,
    algorithm: JWT.algorithm,
    jwtid: jwtid,
  })
  return { accessToken, refreshToken }
}
```

Update the `replace` method to use the `generateTokens` helper function:

```typescript
// TODO: invalidate the token pair using the jti claim
res.json({ data: generateTokens(req.jwtPayload.userId) })
```

Update the `store` method to use the `generateTokens` helper function:

```typescript
res.json({ data: generateTokens(loginCredential.userId) })
```

### 7.3 Test the token refresh

Let's test the token refresh flow. You can use Postman or the `curl` command line tool to send the requests.

```bash
# Create a new access token and refresh token pair
curl -s -X POST http://localhost:3000/api/access-tokens \
  -H 'Content-Type: application/json' \
  -d '{"loginName": "mickey.mouse@example.com", "password": "supersecret"}' \
  | jq

# response similar to:
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTM2MTgsImV4cCI6MTcyMTkxNDUxOCwianRpIjoiMDE5MGVhMGMtYjFjMC03ZDZkLWEwMjAtYTk0MGExYjUwMGVjIn0.EX9bzUP4sbM2BPOZuFZigFk6dySr7Mf1_vSEjiIawkU",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTM2MTgsImV4cCI6MTcyMjA4NjQxOCwianRpIjoiMDE5MGVhMGMtYjFjMC03ZDZkLWEwMjAtYTk0MGExYjUwMGVjIn0.Bbl_KDE62eXoqMnHnO4G4cCI5WnlrVCY9GSkNgrtV2s"
  }
}

# Use the access token in the Authorization header to access a protected resource
curl -s -X GET http://localhost:3000/api/protected-resource \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTM2MTgsImV4cCI6MTcyMTkxNDUxOCwianRpIjoiMDE5MGVhMGMtYjFjMC03ZDZkLWEwMjAtYTk0MGExYjUwMGVjIn0.EX9bzUP4sbM2BPOZuFZigFk6dySr7Mf1_vSEjiIawkU' \
  | jq

# response similar to:
{
  "data": {
    "message": "You have accessed a protected resource",
    "currentUser": {
      "id": "0190d636-feb2-7293-8100-721dde21da52",
      "firstName": "Mickey",
      "lastName": "Mouse",
      "email": "mickey.mouse@example.com",
      "createdAt": "2024-07-21T16:54:06.841Z",
      "updatedAt": "2024-07-21T16:54:06.772Z"
    }
  }
}

# Wait 15 minutes for the access token to expire
# (change the environment variable to a shorter time for testing)
#
# Repeat the request to the protected resource
# You will receive a 401 Unauthorized response
{
  "errors": [
    {
      "status": "401",
      "title": "Unauthorized",
      "detail": "Missing or invalid Authorization header"
    }
  ]
}

# Use the refresh token in the header with the expired access token in the body
# to get a new token pair.
curl -s -X PUT http://localhost:3000/api/access-tokens \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTM2MTgsImV4cCI6MTcyMjA4NjQxOCwianRpIjoiMDE5MGVhMGMtYjFjMC03ZDZkLWEwMjAtYTk0MGExYjUwMGVjIn0.Bbl_KDE62eXoqMnHnO4G4cCI5WnlrVCY9GSkNgrtV2s' \
  -H 'Content-Type: application/json' \
  -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTM2MTgsImV4cCI6MTcyMTkxNDUxOCwianRpIjoiMDE5MGVhMGMtYjFjMC03ZDZkLWEwMjAtYTk0MGExYjUwMGVjIn0.EX9bzUP4sbM2BPOZuFZigFk6dySr7Mf1_vSEjiIawkU"}' \
  | jq

# response similar to:
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTQxNzQsImV4cCI6MTcyMTkxNTA3NCwianRpIjoiMDE5MGVhMTUtMmM3Zi03MDQ0LTk2NDYtZDIwNWIyNGNmN2UzIn0.QdsWBTJX7A1j97j2xeym_IhTZ2-_s2HP2eS3O1uPmbE",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTQxNzQsImV4cCI6MTcyMjA4Njk3NCwianRpIjoiMDE5MGVhMTUtMmM3Zi03MDQ0LTk2NDYtZDIwNWIyNGNmN2UzIn0.U0kagTyAmrqJV0VuHpIPWI8mdXHbEa2uWGpxHLm_8oM"
  }
}

# Use the new access token in the Authorization header to access a protected resource
curl -s -X GET http://localhost:3000/api/protected-resource \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTQxNzQsImV4cCI6MTcyMTkxNTA3NCwianRpIjoiMDE5MGVhMTUtMmM3Zi03MDQ0LTk2NDYtZDIwNWIyNGNmN2UzIn0.QdsWBTJX7A1j97j2xeym_IhTZ2-_s2HP2eS3O1uPmbE' \
  | jq

# response similar to:
{
  "data": {
    "message": "You have accessed a protected resource",
    "currentUser": {
      "id": "0190d636-feb2-7293-8100-721dde21da52",
      "firstName": "Mickey",
      "lastName": "Mouse",
      "email": "mickey.mouse@example.com",
      "createdAt": "2024-07-21T16:54:06.841Z",
      "updatedAt": "2024-07-21T16:54:06.772Z"
    }
  }
}

# Test a token mismatch
# Use the new refresh token with the old access token
curl -s -X PUT http://localhost:3000/api/access-tokens \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTQxNzQsImV4cCI6MTcyMjA4Njk3NCwianRpIjoiMDE5MGVhMTUtMmM3Zi03MDQ0LTk2NDYtZDIwNWIyNGNmN2UzIn0.U0kagTyAmrqJV0VuHpIPWI8mdXHbEa2uWGpxHLm_8oM' \
  -H 'Content-Type: application/json' \
  -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE5MTM2MTgsImV4cCI6MTcyMTkxNDUxOCwianRpIjoiMDE5MGVhMGMtYjFjMC03ZDZkLWEwMjAtYTk0MGExYjUwMGVjIn0.EX9bzUP4sbM2BPOZuFZigFk6dySr7Mf1_vSEjiIawkU"}' \
  | jq

# response:
{
  "errors": [
    {
      "status": "401",
      "title": "Unauthorized",
      "detail": "Invalid refresh token"
    }
  ]
}
```

### Additional Security Considerations

- All tokens must be stored securely on the client side. They should be treated as sensitive information and not exposed to other applications or users.
- All requests with tokens must be transmitted over HTTPS to prevent eavesdropping.
-

### 7.4 Added security restriction

The refresh token should not be accepted in place of the access token when requesting protected resources. It should only be used to request a new access token.

Create a new middleware function that will check set the allowed token type in the request object. This will be used in the protected resource middleware to restrict the token type. The new middleware function will be called `allowRefreshToken`.

The request object will be updated with a new property `refreshTokenIsAllowed` that will be a boolean. This will be used in the `jwtAuthenticatedUser` middleware to check the token type. If the `refreshTokenIsAllowed` property is not set, the default behaviour assume `false` and refresh tokens will be denied.

If the token type is not allowed, the middleware will return an HTTP 401 status code.

### 7.4.1 Add `refreshTokenIsAllowed` to the request object

The express.d.ts file will need to be updated to include the new property in the Request interface.

```typescript
import type { User } from '../user/schema.js'
import { JWTPayload } from '../access-token/schema.js'

declare global {
  namespace Express {
    interface Request {
      currentUser?: User
      jwtPayload?: JWTPayload
      refreshTokenIsAllowed?: boolean
    }
  }
}
```

### 7.4.2 Add a `tokenType` claim to the JWT payload

In the `access-token/schema.ts` file, add a new claim to the `jwtPayloadSchema` schema with two possible values: `access` or `refresh`.

```typescript
export const jwtPayloadSchema = z.object({
  iat: z.number(),
  exp: z.number(),
  jti: z.string().uuid(),
  userId: z.string().uuid(),
  tokenType: z.enum(['access', 'refresh']),
})
```

### 7.4.3 Add the tokenType claim to new tokens

Update the `generateTokens` function in the controller to set the `tokenType` claim:

```typescript
function generateTokens(userId: string) {
  const jwtid = uuidv7()
  const accessToken = jwt.sign({ userId, tokenType: 'access' }, JWT.secret, {
    expiresIn: JWT.idExpiresIn,
    algorithm: JWT.algorithm,
    jwtid: jwtid,
  })
  const refreshToken = jwt.sign({ userId, tokenType: 'refresh' }, JWT.secret, {
    expiresIn: JWT.refreshExpiresIn,
    algorithm: JWT.algorithm,
    jwtid: jwtid,
  })
  return { accessToken, refreshToken }
}
```

### 7.4.4 Implement the `allowRefreshToken` middleware

Create new file called `jwt-allow-refresh-token.ts` in the `middleware` directory.

```typescript
import { Request, Response, NextFunction } from 'express'
export async function allowRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.refreshTokenIsAllowed = true
  next()
}
```

### 7.4.5 Update the `jwtAuthenticatedUser` middleware

Update the `jwtAuthenticatedUser` middleware to check the `refreshTokenIsAllowed` property in the request object.

```typescript
// ...
const rawPayload = jwt.verify(token, JWT.secret)
const payload = jwtPayloadSchema.parse(rawPayload)
if (payload.tokenType === 'refresh' && !req.refreshTokenIsAllowed) {
  console.info('Invalid token type:', payload.tokenType)
  return res.status(401).json(unauthorizedResponse)
}
// ...
```

### 7.4.6 Register the `allowRefreshToken` middleware

The new validation checks will deny refresh tokens by default. You need to explicitly allow them for the PUT and DELETE actions in the `access-token/router.ts` file.

```typescript
import { Router } from 'express'
import * as controller from './controller.js'
import { jwtAuthenticatedUser } from '../middleware/jwt-authenticated-user.js'
import { allowRefreshToken } from '../middleware/jwt-allow-refresh-token.ts.js'

export const accessTokenRouter = Router()

// Base URI: /api/access-tokens -- set in server.ts
accessTokenRouter
  .post('/', controller.store)
  .put('/', allowRefreshToken, jwtAuthenticatedUser, controller.replace)
  .delete('/', allowRefreshToken, jwtAuthenticatedUser, controller.destroy)
```

### 7.4.7 Check token types in the `replace` method

There is one more way to improve security in the `replace` method. You can check the token type in the `replace` method to ensure that the pair of tokens provided have one of each type. This will further prevent an attacker from using a single compromised token to get a new pair.

```typescript
// right under the userId check
if (payload.tokenType === req.jwtPayload.tokenType) {
  throw new Error('Token pair mismatch: tokenType')
}
```

### 7.4.8 Test the token type restrictions

- happy path: valid refresh token in the Authorization header, access token in the body
- happy path: valid access token in the Authorization header, refresh token in the body
- error path: invalid refresh token in the Authorization header, access token in the body
- error path: invalid access token in the Authorization header, refresh token in the body
- error path: valid refresh token in the Authorization header, same token in the body,
- error path: valid access token in the Authorization header, same token in the body
- error path: valid token in the Authorization header, token in the body has different tokenId
- error path: valid token in the Authorization header, token in the body has different userId

Congratulations! You have implemented a token refresh mechanism in your application. This will help to balance the security and usability of your application by automatically refreshing the access token while requiring the user to log in again after a period of inactivity.

In the next step, you will learn how to invalidate tokens to further enhance the security of your application and add the ability to log out a user.

[Continue to Step 8](./step-8.md)

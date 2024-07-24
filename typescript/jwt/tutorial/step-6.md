# Handling JWTs in TypeScript

## 6. Verify the JWT on protected routes

In the previous step, you created a JWT when a user logs in. Now, you will verify the JWT on protected routes to ensure that only authenticated users can access them.

> [!NOTE]
> This is only a check to see that you have logged in and we know who you are. It does not check if you have the correct permissions to access the resource. That is a separate concern that I'll tackle in a future tutorial.

### 6.1 How does the client send the JWT?

When a user logs in, the server sends the JWT back to the client as a response. The client stores the JWT in secure local storage on mobile apps. In a web app you might use session storage or IndexDB. The client then sends the JWT back to the server as a **Bearer Toke** in the `Authorization` header on each subsequent request.

The client might send a fetch request like this:

```typescript
const response = await fetch('https://example.com/api/protected-route', {
  headers: {
    Authorization: `Bearer ${jwt}`,
  },
})
```

### 6.2 How does the server verify the JWT?

The route handler for the protected route will need to extract the token from the Authorization header and then use the `jwt.verify()` method to check the integrity of the token. If the token is valid and has not expired, the payload is unwrapped and return.

Let's write some pseudo code for a protected route handler:

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export const protectedRouteHandler = (req: Request, res: Response) => {
  // Extract the token from the Authorization header
  //   - check if the header is present
  //   - check if the token is a Bearer token
  //   - if either check fails, return a 401 Unauthorized response
  //   - extract the token
  // Verify the token
  //   - if the token is corrupt or expired, return a 401 Unauthorized response
  //   - if the token is valid, extract the payload
  // Load the user profile from the database to make available to the route handler
  // Return the protected resource
}
```

### 6.3 Implement the controller for a protected resource

Create a new `src/protected-resource` directory and add a file called `controller.ts`. Let's keep the example simple for now and just implement a single `index` function that returns a message and the user object belonging to the currently authenticated user.

Import the dependencies and stub out the function:

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../user/schema.js'

export async function index(req: Request, res: Response) {
  // Extract the token from the Authorization header
  // Verify the token and extract the payload

  // Load the user profile from the database
  const currentUser = {}

  // Return the authenticated user in the response with the protected resource content
  return res.json({
    data: {
      message: 'You have accessed a protected resource',
      currentUser,
    },
  })
}
```

According to the pseudo code, you are going to need to return a 401 Unauthorized response from at least two different places in the code. Let's keep the code tidier by creating a variable to hold the formatted response payload with the error message and status code.

```typescript
// just below the imports
const unauthorizedResponse = {
  errors: [
    {
      status: '401',
      title: 'Unauthorized',
      detail: 'Missing or invalid Authorization header',
    },
  ],
}
// above the index function
```

Now extract the token from the Authorization header. If the header is missing or the token is not a Bearer token, return the unauthorized response.

```typescript
const [authorizationType, token] = req.headers.authorization?.split(' ') ?? []
if (authorizationType !== 'Bearer' || !token) {
  console.info('Missing or invalid Authorization header')
  return res.status(401).json(unauthorizedResponse)
}
```

> [!TIP]
> The `?.` operator is the optional chaining operator. It allows you to safely access deeply nested properties without having to check if each level exists. If the property is `null` or `undefined`, the expression short-circuits and returns `undefined`.
> The `??` operator is the nullish coalescing operator. It returns the right-hand operand when the left-hand operand is `null` or `undefined`.
> Combining these two operators makes the code more concise and easier to read.

Now verify the token and extract the payload. If the token is corrupt or expired, return the unauthorized response. Otherwise let's return the payload as an interim step. So you can check your work.

```typescript
const jwtSecret = process.env.JWT_SECRET || 'missing-secret'
try {
  const payload = jwt.verify(token, jwtSecret)
  res.json({
    data: {
      message: 'You have accessed a protected resource',
      jwtPayload: payload,
    },
  })
} catch (error) {
  console.info('JWT verification failed:', error)
  return res.status(401).json(unauthorizedResponse)
}
```

> [!NOTE]
> Both of these code blocks log an info level message to help with debugging and monitoring. They are not logged with an error level because it is a common occurrence, properly handled and not a problem with the server.

### 6.3.1 Create a router for the protected resource

```typescript
import { Router } from 'express'
import * as controller from './controller.js'

export const protectedResourceRouter = Router()

// Base URI: /api/protected-resource -- set in server.ts
protectedResourceRouter.route('/').get(controller.index)
```

Register this up in `src/server.ts`. Now you can test the protected route by sending a request with a valid JWT in the Authorization header. First, you need to log in to get a valid JWT, then copy the token and use it in the Authorization header of the request to the protected route.

```bash
curl -X POST http://localhost:3000/api/access-tokens \
  -H 'Content-Type: application/json' \
  -d '{"loginName": "mickey.mouse@example.com", "password": "supersecret"}'

# response
{"data":{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE4MzI4MDQsImV4cCI6MTcyMTgzMzcwNH0.FCBEutLROVNpq4-0SEMpqv0jbTcrHwBrUKw7ruLvAWk","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE4MzI4MDQsImV4cCI6MTcyMjAwNTYwNH0.T0IjyQyUe6GWDWizk46CWGuE2gqrzRfooeRh0qMuOwE"}}%
```

That works but, man it is ugly to read the results. Let's pretty print the JSON output with `jq`. If you don't have `jq` installed, you can install it with `brew install jq` on macOS or `sudo apt-get install jq` on Ubuntu.

Use the `-s` flag to suppress the progress meter and the `-X` flag to specify the request method. The `-H` flag is used to set the `Content-Type` header, and the `-d` flag is used to send the JSON payload. The `| jq` command at the end pipes the output to `jq` to pretty print the JSON.

```bash
curl -s -X POST http://localhost:3000/api/access-tokens \
  -H 'Content-Type: application/json' \
  -d '{"loginName": "mickey.mouse@example.com", "password": "supersecret"}' | jq

# response
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE4MzMyODcsImV4cCI6MTcyMTgzNDE4N30.7KA3npC_wDDrb5fM73TIVU76ZIhPTXk_yVm-oefXe0c",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE4MzMyODcsImV4cCI6MTcyMjAwNjA4N30.vmQOPwG2cGMnXqe0QKbwAFc7H-xERzCMmJrflRVR6Jw"
  }
}
```

That's a little better to work with. Now copy the `accessToken` and use it in the Authorization header of the request to the protected route.

```bash
curl -s http://localhost:3000/api/protected-resource \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE4MzMyODcsImV4cCI6MTcyMTgzNDE4N30.7KA3npC_wDDrb5fM73TIVU76ZIhPTXk_yVm-oefXe0c' \
  | jq

# response similar to
{
  "data": {
    "message": "You have accessed a protected resource",
    "jwtPayload": {
      "userId": "0190d636-feb2-7293-8100-721dde21da52",
      "iat": 1721833287,
      "exp": 1721834187
    }
  }
}
```

Try it without the Authorization header or with an invalid token to see the 401 Unauthorized response.

```bash
curl -s http://localhost:3000/api/protected-resource | jq

{
  "errors": [
    {
      "status": "401",
      "title": "Unauthorized",
      "detail": "Missing or invalid Authorization header"
    }
  ]
}
```

### 6.3.2 Load the user profile from the database

OK now that you have the JWT payload, its time to load the user profile from the database. The `userId` in the payload is the primary key for the user profile. Use the `eq` function from Drizzle ORM in the `where` property of the `findFirst()` method to load the user profile.

```typescript
  try {
    const payload = jwt.verify(token, jwtSecret)
    // Load the user from the database
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    })
```

You will probable see TypeScript squawking about the `payload.userId` property. That's because the payload is typed as `any`. Let's fix that by creating a schema for the JWT payload.

### 6.3.3 Create access-token/schema.ts

```typescript
import { z } from 'zod'

export const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
})

export type JWTPayload = z.infer<typeof jwtPayloadSchema>
```

Import the `jwtPayloadSchema` Zod schema in your controller and use it to parse the payload return value from the `jwt.verify()` method. This will correctly type the payload as `JWTPayload`, and it will throw an error if the payload does not match the schema.

> [!TIP]
> If Zod does throw an error here, it tells you that you made a mistake in the code that generated the JWT. This is a good thing because it helps you catch bugs early. You can find the error in the logs and fix the code that generated the JWT.

```typescript
import type { JWTPayload } from '../access-token/schema.js'

// ...
const payload = jwtPayloadSchema.parse(jwt.verify(token, jwtSecret))
```

### 6.3.4 What if there is no user profile?

If the login-credential was loaded and verified, but the user profile was not found, there are two possibilities:

1. The user profile was deleted after the token was issued.
2. The referential integrity of the database is compromised and the login-credential is not associated with a user profile.

In either case, you should return a 401 Unauthorized response. This is a security measure to ensure the correct functioning of your application. You definitely want to log this event as an error to investigate further. It might also be a good idea to invalidate the token -- we'll cover how to do that in the next section.

```typescript
const currentUser = await db.query.users.findFirst({
  where: eq(users.id, payload.userId),
})
if (!currentUser) {
  console.error(
    'Unable to retrieve User from the database with the provided JWT payload',
    payload,
  )
  return res.status(401).json(unauthorizedResponse)
}
```

With that guard in place you can update the response to include the user profile.

```typescript
return res.json({
  data: {
    message: 'You have accessed a protected resource',
    currentUser,
  },
})
```

Test your work by sending a request to the protected route with a valid JWT in the Authorization header. You should see the user profile in the response similar to this:

```bash
curl -s http://localhost:3000/api/protected-resource \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkwZDYzNi1mZWIyLTcyOTMtODEwMC03MjFkZGUyMWRhNTIiLCJpYXQiOjE3MjE4MzYzOTYsImV4cCI6MTcyMTgzNzI5Nn0.Tmkx_sowg7upgxB6iTQHyE384gfBAspj0kMuzRNBDjQ' \
  | jq

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

```

> [!TIP]
> Your token may have expired while you were working on this. If you get a 401 Unauthorized response, you can log in again to get a new token.

### 6.3.4 Refactor the JWT configuration

Did you notice that the environment variables are being read in multiple files throughout your code? Each time you need to provide some default value if the environment variable is not set. Not only is there duplication, there is opportunity for inconsistency.

This is a good candidate for refactoring!

Create a new file `src/config.ts` and move the JWT configuration into it.

```typescript
import type { Secret, Algorithm } from 'jsonwebtoken'

export const JWT = {
  secret: (process.env.JWT_SECRET || 'notSoSecret') as Secret,
  algorithm: (process.env.JWT_ALGORITHM || 'HS256') as Algorithm,
  idExpiresIn: process.env.JWT_ID_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '2d',
} as const
```

> [!TIP]
> Remember the `jwt.verify()` method requires the `as Secret` and `as Algorithm` type assertions to ensure correct function overload is applied.

> [!TIP]
> The `as const` assertion is used to make the object read-only. This prevents accidental modification of the object properties.

Now import the JWT configuration in your controller and use it to verify the token.

```typescript
import { JWT } from '../config.js'
// ...
const payload = jwtPayloadSchema.parse(jwt.verify(token, JWT.secret))
```

Test it and make sure everything still works as expected.

OK, now let's apply the same refactoring to the `access-token/controller.ts` file.

```typescript
import { JWT } from '../config.js'
// remove the import type { Secret, Algorithm } from 'jsonwebtoken'
// ...
// remove the hardcoded JWT constant
```

Let's also move the `SALT_ROUNDS` constant to the config module. The bcrypt salt rounds is currently defined in both the `access-token/controller.ts` and the `login-credentials/schema.ts` files.

Add this to the `config.ts` file:

```typescript
export const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '15')
```

And then import it back into the controller and the schema files.

**Test it and make sure everything still works as expected.**

### 6.3.5 Refactor the database configuration

While you're at it, you might want to apply similar refactoring to the database configuration details. Move the config from `db/pg-url.ts` to `src/config.ts` and then delete the `db/pg-url.ts` file.

```typescript
export const DB = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || '5432',
  user: process.env.PG_USER || 'dev_user',
  password: process.env.PG_PASSWORD || 'dev_password',
  database: process.env.PG_DATABASE || 'authentication_tutorial',
  get connectionString() {
    return `postgres://${this.user}:${this.password}@${this.host}:${this.port}/${this.database}`
  },
} as const
```

Change the imports in `src/db/index.ts` and `/drizzle.config.ts` to use the new common configuration module. e.g.

```typescript
import { DB } from '../config.js'
const queryClient = postgres(DB.connectionString)
```

### 6.3.6 Refactor `load-env`

Now that you have a single place to read the environment variables, you can remove the `load-env.ts` file and move its content to the top of the `config.ts` file.

```typescript
import { config } from 'dotenv'
config()
```

Don't forget to remove the import from `src/server.ts` and `drizzle.config.ts`. It is no longer needed.

### 6.3.7 Refactor drizzle-config

While you are here, you are going to need to update the `drizzle.config.ts` to be a `.js` module and have it load the imports from the `dist` directory instead of the `src` directory.

This is because the way drizzle-kit works with TypeScript config files is incompatible with the rest of the project. So it is simpler to set the config as a JavaScript module and import the compiled TypeScript files.

```typescript
import { defineConfig } from 'drizzle-kit'
import { DB } from './dist/config.js'

export default defineConfig({
  dialect: 'postgresql', // database dialect
  schema: './dist/db/schema.js', // path to schema files
  out: './drizzle', // output directory for migration scripts
  dbCredentials: {
    url: DB.connectionString, // database connection string
  },
})
```

And when we moved the schema files to their respective domain directories, the re-export format broke the drizzle-kit migration generator. It is an easy two step fix. Removed the namespaced exports and re-export the schema files directly.

```typescript
// src/db/schema.ts
export * from '../user/schema.js'
export * from '../login-credential/schema.js'
```

```typescript
// src/db/index.ts
import * as schema from './schema.js'
// ...
export const db = drizzle(queryClient, {
  schema: { ...schema },
})
```

That should do it.

Once more, test it and make sure everything still works as expected.

Awesome!
That feels so much better! It is safer and makes it easier to manage updates to the configuration details in the future.

### 6.5 Refactor to extract a middleware module

Most of the code in this route handler is concerned with verifying the JWT and loading the user profile. You do not want to be repeating that for every protected resource, which is likely most of your application.

Extract the common code into a middleware function that can be used on any route that requires the user to have been authenticated.

### 6.6 Refactor to encapsulate the login/logout logic

`SALT_ROUNDS` was only being used in the `access-token/controller` to create the `badHash` constant. What if you make the `login-credential` model (schema) responsible for creating the `badHash` constant?

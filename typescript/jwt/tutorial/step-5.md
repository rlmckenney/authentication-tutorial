# Handling JWTs in TypeScript

## 5. Handle the Login flow

In this step, you will implement the login flow for your authentication system. The login flow will accept a username and password, validate the credentials, and return two JWTs if the credentials are correct. The first JWT will be a short-lived access token, and the second JWT will be a longer-lived refresh token.

> [!NOTE]
> Good application security requires a multilayered strategy. The choice of two tokens is a common pattern to mitigate the risk of token theft. The access token has a short expiration time, while the refresh token has a longer expiration time. If the access token is stolen, the window of opportunity for an attacker to use it is limited.
> The refresh token is used to request a new access token without having to log in again. Because the refresh token is not sent with every request, it has a reduced the risk of token theft.

You should group the authentication related logic into its own folder, just like you did with `src/user` and `src/login-credentials`. What should you name this folder? Well, what kind of resource are you managing?

If you have worked with traditional web applications, you might have heard of a "session". A session is a way to keep track of a user's state across multiple requests. This mechanism typically uses a unique sessionId sent to the browser as a cookie and it is the primary key of the session table in your database.

In a stateless application like this one, each API request is independent of any others. The JWT is a lightweight mechanism to say, "I have already been authenticated, and my userId is <uniqueID>".

It sounds like this is a token that represents a user's access status. Let's call this folder `src/access-token`. Create that now.

> [!TIP]
> Taking a couple of extra minutes to name things well can massively improve the readability of your code. It's worth the time!

What will the RESTful routes be for this resource? You will need to create a new token when a user logs in, and you will need to refresh the token when it expires. You will also need to invalidate the token when a user logs out.

- POST `/api/access-tokens` - Create a new access token and refresh token (login)
- PUT `/api/access-tokens` - Replace the access token and refresh token (refresh)
- DELETE `/api/access-tokens` - Invalidate the access token (logout)

### 5.1 Create the access-token router

1. Create a new `router.ts` file in the `src/access-token` directory. This file will contain the login route handler.

```typescript
import { Router } from 'express'
import * as controller from './controller.js'

export const accessTokenRouter = Router()

// Base URI: /api/access-tokens -- set in server.ts
accessTokenRouter.route('/').post(controller.store)
accessTokenRouter
  .route('/:id')
  .put(controller.replace)
  .delete(controller.destroy)
```

> [!NOTE]
> In previous routers you used the `patch` method to update a resource. In this case, you will use the `put` method. The semantic meaning of the `put` method is to replace the entire resource, while the `patch` method is used to update only the fields that are provided. In this case, you want to throw away the old tokens and generate new ones, so `put` is the correct method to use.

### 5.2 Create the access-token controller

Let's quickly stub out the three controller methods in `src/access-token/controller.ts`.

```typescript
import { Request, Response } from 'express'

export async function store(req: Request, res: Response) {
  res.json({ data: 'store' })
}

export async function replace(req: Request, res: Response) {
  res.json({ data: 'replace' })
}

export async function destroy(req: Request, res: Response) {
  res.json({ data: 'destroy' })
}
```

### 5.3 Add the access-token router to the server

```typescript
import { accessTokenRouter } from './access-token/router.js'
// ... other routes
app.use('/api/access-tokens', accessTokenRouter)
```

Test that everything is working by running the server and sending a POST request to `/api/access-tokens`. You should see the response `{"data":"store"}`.

### 5.4 Implement the login flow

The POST request to `/api/access-tokens` will be the login route. It will accept a username and password, validate the credentials, and return two JWTs if the credentials are correct.

### 5.4.1 Install the `jsonwebtoken` package

You will need to install the `jsonwebtoken` package to create the JWTs.

```bash
pnpm add jsonwebtoken
pnpm add --save-dev @types/jsonwebtoken
```

### 5.4.2 Create a JWT secret

When creating a JWT, you need a secret key to sign the token. This secret key should be kept secure and should not be shared. You can generate a random secret key using the following command:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> [!TIP]
> Add this a script in your package.json file to make it easier to generate the secret key in the future.
>
> ```json
> "make:jwt-secret": "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
> ```
>
> Then you can run `pnpm make:jwt-secret` to generate a new secret key.

It is important to keep this secret key secure. You should never hardcode it in your application code or share it with others. You can manually inject an environment variable or use a secure secrets management service.

Add your generated key to your local environment.

```bash
export JWT_SECRET=your_secret_key_here
```

### 5.4.3 Plan the `store` method logic

Let's add some pseudo code for what the `store` method needs to do.

```typescript
export async function store(req: Request, res: Response) {
  // parse the request body
  // retrieve the loginCredential from the database by username
  // compare the password from the request body with the loginCredential.passwordHash
  // if the password is correct, create an access token and refresh token
  //   the tokens should encode loginCredential.userId in the payload
  //   the primary token should have a short expiry time (e.g. 15 minutes)
  //   the refresh token should have a longer expiry time (e.g. 2 days)
  // return the tokens in the response
  // if the password is incorrect, return a 401 status code
  // if the loginCredential is not found, also return a 401 status code
  // NEVER store valid tokens in the database!

  res.json({ data: 'store' })
}
```

Looks good! Let's implement this logic.

### 5.4.4 Parse the request body

You can create a new Zod parser for the login request body. This parser will validate that the request body contains the required fields and that they conform to the expected types.

To ensure consistency, update the `login-credential/schema.ts` file to export the `baseSchema` as a named export.

```typescript
import { Request, Response } from 'express'
import { baseSchema } from '../login-credential/schema.js'

const loginParamsSchema = baseSchema.pick({ loginName: true, password: true })

export async function store(req: Request, res: Response) {
  const { loginName, password } = loginParamsSchema.parse(req.body)
```

### 5.4.5 Retrieve the loginCredential from the database

Update the imports to include the Drizzle ORM query functions, the database connection, and the loginCredential schema.

Then add the db query in the `store` method body to retrieve the loginCredential by loginName.

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { baseSchema, loginCredentials } from '../login-credential/schema.js'
// ... other code

// db returns undefined if not found
const loginCredential = await db.query.loginCredentials.findFirst({
  where: eq(loginCredentials.loginName, loginName),
})
```

Great! For now let's follow the happy path. We'll handle the not found case shortly.

### 5.4.6 Compare the password

You will need to compare the password from the request body with the `loginCredential.passwordHash`. Use the `bcrypt.compare` method to check for a match.

```typescript
import bcrypt from 'bcrypt'

const passwordDidMatch = await bcrypt.compare(
  password,
  loginCredential.passwordHash,
)
```

If there was no match, or the loginName was not found, you should send a 401 status response. To avoid [timing attacks](https://en.wikipedia.org/wiki/Timing_attack), you should always compare the password even if the loginName was not found.

To accomplish this, create a new variable called `passwordHash` and set it to either the `loginCredential.passwordHash` or an invalid placeholder hash. Then compare the `password` with the `passwordHash`.

To make sure that it takes the same amount of time to compare the password, the placeholder hash needs to use the same `SALT_ROUNDS` value as a real password hash.

```typescript
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 14

const badHash = `$2b$${SALT_ROUNDS}$invalidusernameaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
const passwordHash = loginCredential?.passwordHash ?? badHash

const passwordDidMatch = await bcrypt.compare(password, passwordHash)
```

Now check if the password matched and return a 401 status if it didn't.

```typescript
if (!loginCredential || !passwordDidMatch) {
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

Checking for `!loginCredential` does not change the logic condition, but it does let TypeScript know that any later references to `loginCredential` will be defined.

> [!WARNING]
> Never let an attacker know which of the credential components failed. This information can be used by attackers to gain access to your system. Always return a generic error message like "Invalid login credentials" to the client.

### 5.4.7 Create the JWTs

> [!IMPORTANT]
> You should read the full [documentation on the jsonwebtoken library](https://www.npmjs.com/package/jsonwebtoken) but here are two critical things to understand:
>
> 1. The payload is hashed, **not encrypted**. Anyone with some JavaScript can read it. **Never put sensitive data in the token payload**.
> 2. The token is cryptographically signed using your secret key. So you can validate that no one has altered the contents of the payload. Which means you can trust it.

The `jsonwebtoken` package has a `sign` method that you can use to create a token. The method takes three arguments: the payload, the secret key, and an options object.

The payload is an object that contains the data you want to encode in the token. In this case, you want to encode the `loginCredential.userId`.

The secret key is the key you generated earlier.

The options object contains the `expiresIn` property, which accepts convenient time formats like `'15m'` for 15 minutes or `'2d'` for 2 days.

To allow flexibility to update the token options in the future, you can create a `JWT` object with the option values coming from environment variables, with defaults if the environment variables are not set.

```typescript
import jwt from 'jsonwebtoken'
import type { Secret, Algorithm } from 'jsonwebtoken'
// ... other code
const JWT = {
  secret: (process.env.JWT_SECRET || 'notSoSecret') as Secret,
  algorithm: (process.env.JWT_ALGORITHM || 'HS256') as Algorithm,
  idExpiresIn: process.env.JWT_ID_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '2d',
} as const

export async function store(req: Request, res: Response) {
  // ... under the existing method body
  const jwtPayload = { userId: loginCredential.userId }

  const accessToken = jwt.sign(jwtPayload, JWT.secret, {
    expiresIn: JWT.idExpiresIn,
    algorithm: JWT.algorithm,
  })
  const refreshToken = jwt.sign(jwtPayload, JWT.secret, {
    expiresIn: JWT.refreshExpiresIn,
    algorithm: JWT.algorithm,
  })

  res.json({ data: { accessToken, refreshToken } })
}
```

> [!IMPORTANT]
> The `JWT` object has some TypeScript type assertions. These are necessary to ensure that the correct overload of the `jsonwebtoken.sign` method is used.

OK, let's test this out. Run the server and send a POST request to `/api/access-tokens` with a valid username and password. You should receive a response with two tokens.

```bash
curl -X POST http://localhost:3000/api/access-tokens -H "Content-Type: application/json" -d '{"loginName": "user@example.com", "password": "password"}'
```

Looks good! You have implemented the login flow and can now generate JWTs for your users.

[Continue to Step 6: Verify a JWT](./step-6.md)

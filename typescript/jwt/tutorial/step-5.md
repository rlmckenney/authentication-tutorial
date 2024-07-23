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

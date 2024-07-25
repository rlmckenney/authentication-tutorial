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

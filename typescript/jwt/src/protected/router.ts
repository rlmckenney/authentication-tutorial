import { Router } from 'express'
import * as controller from './controller.js'
import { jwtAuthenticatedUser } from '../middleware/jwt-authenticated-user.js'

export const protectedResourceRouter = Router()
protectedResourceRouter.use(jwtAuthenticatedUser)

// Base URI: /api/protected-resource -- set in server.ts
protectedResourceRouter.route('/').get(controller.index)
// .post(controller.store)

// protectedResourceRouter
//   .route('/:id')
//   .get(controller.show)
//   .patch(controller.update)
//   .delete(controller.destroy)

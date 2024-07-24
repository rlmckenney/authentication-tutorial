import { Router } from 'express'
import * as controller from './controller.js'

export const protectedResourceRouter = Router()

// Base URI: /api/protected-resource -- set in server.ts
protectedResourceRouter.route('/').get(controller.index)
// .post(controller.store)

// protectedResourceRouter
//   .route('/:id')
//   .get(controller.show)
//   .patch(controller.update)
//   .delete(controller.destroy)

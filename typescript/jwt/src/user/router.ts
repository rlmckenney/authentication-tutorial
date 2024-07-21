import { Router } from 'express'
import * as controller from './controller.js'

export const userRouter = Router()

// Base URI: /api/users -- set in server.ts
userRouter.route('/')
  .get(controller.index)
  .post(controller.store)

userRouter
  .route('/:id')
  .get(controller.show)
  .patch(controller.update)
  .delete(controller.destroy)

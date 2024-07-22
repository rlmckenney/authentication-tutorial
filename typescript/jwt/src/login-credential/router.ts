import { Router } from 'express'
import * as controller from './controller.js'

export const loginCredentialRouter = Router()

// Base URI: /api/login-credentials -- set in server.ts
loginCredentialRouter
  .route('/')
  .get(controller.index)
  .post(controller.store)

loginCredentialRouter
  .route('/:id')
  .get(controller.show)
  .patch(controller.update)
  .delete(controller.destroy)

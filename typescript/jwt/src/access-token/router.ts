import { Router } from 'express'
import * as controller from './controller.js'

export const accessTokenRouter = Router()

// Base URI: /api/access-tokens -- set in server.ts
accessTokenRouter.route('/').post(controller.store)
accessTokenRouter
  .route('/:id')
  .put(controller.replace)
  .delete(controller.destroy)

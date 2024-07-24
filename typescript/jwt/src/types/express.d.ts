import type { User } from '../user/schema.js'

declare global {
  namespace Express {
    interface Request {
      currentUser?: User
    }
  }
}

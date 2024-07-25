import type { User } from '../user/schema.js'
import { JWTPayload } from '../access-token/schema.js'

declare global {
  namespace Express {
    interface Request {
      currentUser?: User
      jwtPayload?: JWTPayload
      refreshTokenIsAllowed?: boolean
    }
  }
}

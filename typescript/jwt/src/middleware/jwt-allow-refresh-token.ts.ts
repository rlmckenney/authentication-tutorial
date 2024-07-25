import { Request, Response, NextFunction } from 'express'
export async function allowRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.refreshTokenIsAllowed = true
  next()
}

import { Request, Response } from 'express'

export async function index(req: Request, res: Response) {
  return res.json({
    data: {
      message: 'You have accessed a protected resource',
      currentUser: req.currentUser,
    },
  })
}

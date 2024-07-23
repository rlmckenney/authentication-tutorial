import { Request, Response } from 'express'

export async function store(req: Request, res: Response) {
  res.json({ data: 'store' })
}

export async function replace(req: Request, res: Response) {
  res.json({ data: 'replace' })
}

export async function destroy(req: Request, res: Response) {
  res.json({ data: 'destroy' })
}

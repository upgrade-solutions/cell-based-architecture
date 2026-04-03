export function generateAuth(): string {
  return `import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'

export function createAuthMiddleware(endpoint: any, api: any, operational: any) {
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const policy = operational.policies?.find((p: any) => p.capability === capability)
  const requiredRoles: string[] = policy?.allow?.map((a: any) => a.role) ?? []

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.slice(7)
    let decoded: jwt.JwtPayload
    try {
      decoded = jwt.decode(token) as jwt.JwtPayload
      if (!decoded) throw new Error('invalid token')
    } catch {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    ;(req as any).user = decoded

    if (requiredRoles.length) {
      const userRoles: string[] = decoded['https://acme.finance/roles'] ?? []
      if (!requiredRoles.some((r: string) => userRoles.includes(r))) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    next()
  }
}
`
}

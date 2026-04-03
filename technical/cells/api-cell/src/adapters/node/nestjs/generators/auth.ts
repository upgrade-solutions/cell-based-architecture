export function generateAuthGuard(): string {
  return `import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as jwt from 'jsonwebtoken'

// TODO: Replace decodeToken with full JWKS verification for production.
// See: https://auth0.com/docs/quickstart/backend/nodejs

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException()

    let decoded: jwt.JwtPayload
    try {
      // TODO: Replace with JWKS signature verification
      decoded = jwt.decode(token) as jwt.JwtPayload
      if (!decoded) throw new Error('invalid token')
    } catch {
      throw new UnauthorizedException()
    }

    request.user = decoded

    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler())
    if (requiredRoles?.length) {
      // Auth0 custom claim — configure your namespace in Auth0 Actions
      const userRoles: string[] = decoded['https://acme.finance/roles'] ?? []
      if (!requiredRoles.some(r => userRoles.includes(r))) {
        throw new ForbiddenException()
      }
    }

    return true
  }

  private extractToken(request: { headers?: { authorization?: string } }): string | null {
    const auth = request.headers?.authorization
    if (!auth?.startsWith('Bearer ')) return null
    return auth.slice(7)
  }
}
`
}

export function generateRolesDecorator(): string {
  return `import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
`
}

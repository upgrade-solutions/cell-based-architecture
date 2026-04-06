export function generateAuthGuard(authConfig?: { domain: string; audience: string; roleClaim: string }): string {
  const domain = authConfig?.domain ?? 'AUTH0_DOMAIN'
  const audience = authConfig?.audience ?? 'AUTH0_AUDIENCE'
  const roleClaim = authConfig?.roleClaim ?? 'roles'

  return `import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const AUTH_DOMAIN = process.env.AUTH0_DOMAIN ?? '${domain}'
const AUTH_AUDIENCE = process.env.AUTH0_AUDIENCE ?? '${audience}'
const ROLE_CLAIM = '${roleClaim}'

const jwks = jwksClient({
  jwksUri: \`https://\${AUTH_DOMAIN}/.well-known/jwks.json\`,
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
})

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err: any, key: any) => {
      if (err) return reject(err)
      resolve(key.getPublicKey())
    })
  })
}

function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string') return reject(new Error('Invalid token'))

    getSigningKey(decoded.header.kid ?? '')
      .then(publicKey => {
        jwt.verify(token, publicKey, {
          audience: AUTH_AUDIENCE,
          issuer: \`https://\${AUTH_DOMAIN}/\`,
          algorithms: ['RS256'],
        }, (err, payload) => {
          if (err) return reject(err)
          resolve(payload as jwt.JwtPayload)
        })
      })
      .catch(reject)
  })
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException()

    let payload: jwt.JwtPayload
    try {
      payload = await verifyToken(token)
    } catch {
      throw new UnauthorizedException()
    }

    request.user = payload

    // Role check — read roles from the IDP-configured claim path
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler())
    if (requiredRoles?.length) {
      const userRoles: string[] = (payload[ROLE_CLAIM] as string[]) ?? []
      if (!requiredRoles.some(r => userRoles.includes(r))) {
        throw new ForbiddenException()
      }
    }

    // Ownership flag — attach to request for service-level enforcement
    const requiresOwnership = this.reflector.get<boolean>('requiresOwnership', context.getHandler())
    if (requiresOwnership) {
      request.requiresOwnership = true
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

export const OWNERSHIP_KEY = 'requiresOwnership'
export const RequiresOwnership = () => SetMetadata(OWNERSHIP_KEY, true)
`
}

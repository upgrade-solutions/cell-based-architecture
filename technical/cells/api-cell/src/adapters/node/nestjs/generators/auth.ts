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
import { isFlagEnabled } from './flags'

const AUTH_DOMAIN = process.env.AUTH0_DOMAIN ?? '${domain}'
const AUTH_AUDIENCE = process.env.AUTH0_AUDIENCE ?? '${audience}'
const ROLE_CLAIM = '${roleClaim}'

// ── Allow-entry shape (from operational DNA rule.allow) ──────────────────────
interface AllowEntry {
  role?: string
  ownership?: boolean
  flags?: string[]
}

// An allow entry matches iff:
//   (no role OR user has the role) AND
//   (every flag in entry.flags is currently enabled)
// Ownership is enforced downstream in the service. Cross-entry is OR.
function entryMatches(entry: AllowEntry, userRoles: string[]): boolean {
  if (entry.role && !userRoles.includes(entry.role)) return false
  if (Array.isArray(entry.flags) && entry.flags.length > 0) {
    if (!entry.flags.every(f => isFlagEnabled(f))) return false
  }
  return true
}

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

    // Allow-entry check — honors role + flags, uses @Allow metadata first;
    // falls back to @Roles metadata for backward compatibility.
    const allowEntries = this.reflector.get<AllowEntry[]>('allow', context.getHandler())
    if (allowEntries?.length) {
      const userRoles: string[] = (payload[ROLE_CLAIM] as string[]) ?? []
      if (!allowEntries.some(entry => entryMatches(entry, userRoles))) {
        throw new ForbiddenException()
      }
    } else {
      const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler())
      if (requiredRoles?.length) {
        const userRoles: string[] = (payload[ROLE_CLAIM] as string[]) ?? []
        if (!requiredRoles.some(r => userRoles.includes(r))) {
          throw new ForbiddenException()
        }
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

// Full allow-entry metadata — honors role + flags (+ optional ownership).
// Preferred over @Roles for rules that reference feature flags.
export interface AllowEntry {
  role?: string
  ownership?: boolean
  flags?: string[]
}

export const ALLOW_KEY = 'allow'
export const AccessAllow = (entries: AllowEntry[]) => SetMetadata(ALLOW_KEY, entries)
`
}

/**
 * Default feature-flag source. Reads flags from `FLAG_<UPPER_SNAKE>` env vars.
 * Emitted as its own module so users can override a single file to plug in
 * LaunchDarkly / Unleash / GrowthBook without touching the generated authz.
 */
export function generateFlags(): string {
  return `// Default feature-flag source — reads FLAG_<UPPER_SNAKE> env vars.
// Override this module to plug in LaunchDarkly / Unleash / GrowthBook etc.
// The AuthGuard imports { isFlagEnabled } from './flags'.

export function isFlagEnabled(name: string): boolean {
  const envName = 'FLAG_' + name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const raw = process.env[envName]
  return raw === '1' || raw === 'true'
}
`
}

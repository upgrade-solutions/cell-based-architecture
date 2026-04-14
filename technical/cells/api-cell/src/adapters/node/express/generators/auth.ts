export function generateAuth(authMode?: string): string {
  if (authMode === 'built-in') return generateBuiltInAuth()
  return generateOidcAuth()
}

/**
 * Default feature-flag source. Reads flags from `FLAG_<UPPER_SNAKE>` env vars.
 * Emitted as its own module so users can override a single file to plug in
 * LaunchDarkly / Unleash / GrowthBook without touching the generated authz.
 */
export function generateFlags(): string {
  return `// Default feature-flag source — reads FLAG_<UPPER_SNAKE> env vars.
// Override this module to plug in LaunchDarkly / Unleash / GrowthBook etc.
// The authz middleware imports { isFlagEnabled } from './flags'.

export function isFlagEnabled(name: string): boolean {
  const envName = 'FLAG_' + name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const raw = process.env[envName]
  return raw === '1' || raw === 'true'
}
`
}

function generateBuiltInAuth(): string {
  return `import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import { isFlagEnabled } from './flags'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => {
      if (err) return reject(err)
      resolve(payload as jwt.JwtPayload)
    })
  })
}

// ── Allow-entry matcher ──────────────────────────────────────────────────────
// An allow entry matches iff:
//   (no role OR user has the role) AND
//   (no ownership constraint — ownership is enforced downstream in the handler) AND
//   (every flag in entry.flags is currently enabled)
// Cross-entry semantics is OR; within-entry is AND.
function entryMatches(entry: any, userRoles: string[]): boolean {
  if (entry.role && !userRoles.includes(entry.role)) return false
  if (Array.isArray(entry.flags) && entry.flags.length > 0) {
    if (!entry.flags.every((f: string) => isFlagEnabled(f))) return false
  }
  return true
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function createAuthMiddleware(endpoint: any, api: any, operational: any) {
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const rule = (operational.rules ?? []).find(
    (r: any) => r.capability === capability && r.type === 'access',
  )
  const allowEntries: any[] = rule?.allow ?? []
  const requiresOwnership = allowEntries.some((a: any) => a.ownership)
  const hasAllow = allowEntries.length > 0

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token)
      ;(req as any).user = payload

      // Role + flag check — at least one allow entry must match.
      if (hasAllow) {
        const userRoles: string[] = (payload.roles as string[]) ?? []
        if (!allowEntries.some((entry: any) => entryMatches(entry, userRoles))) {
          return res.status(403).json({ message: 'Forbidden' })
        }
      }

      if (requiresOwnership) {
        ;(req as any).requiresOwnership = true
      }

      next()
    } catch {
      return res.status(401).json({ message: 'Unauthorized' })
    }
  }
}
`
}

function generateOidcAuth(): string {
  return `import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import * as fs from 'fs'
import * as path from 'path'
import { isFlagEnabled } from './flags'

// ── Load auth config from Technical DNA ──────────────────────────────────────

const AUTH_CONFIG_PATH = path.resolve(__dirname, 'dna/auth.json')
const authConfig: { domain: string; audience: string; roleClaim: string } | null =
  fs.existsSync(AUTH_CONFIG_PATH) ? JSON.parse(fs.readFileSync(AUTH_CONFIG_PATH, 'utf-8')) : null

// ── JWKS client — fetches and caches public keys from the IDP ────────────────

const jwks = authConfig
  ? jwksClient({
      jwksUri: \`https://\${authConfig.domain}/.well-known/jwks.json\`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
    })
  : null

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!jwks) return reject(new Error('Auth not configured'))
    jwks.getSigningKey(kid, (err: any, key: any) => {
      if (err) return reject(err)
      resolve(key.getPublicKey())
    })
  })
}

function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    if (!authConfig) return reject(new Error('Auth not configured'))

    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string') return reject(new Error('Invalid token'))

    getSigningKey(decoded.header.kid ?? '')
      .then(publicKey => {
        jwt.verify(token, publicKey, {
          audience: authConfig.audience,
          issuer: \`https://\${authConfig.domain}/\`,
          algorithms: ['RS256'],
        }, (err, payload) => {
          if (err) return reject(err)
          resolve(payload as jwt.JwtPayload)
        })
      })
      .catch(reject)
  })
}

// ── Allow-entry matcher ──────────────────────────────────────────────────────
// An allow entry matches iff:
//   (no role OR user has the role) AND
//   (no ownership constraint — ownership is enforced downstream in the handler) AND
//   (every flag in entry.flags is currently enabled)
// Cross-entry semantics is OR; within-entry is AND.
function entryMatches(entry: any, userRoles: string[]): boolean {
  if (entry.role && !userRoles.includes(entry.role)) return false
  if (Array.isArray(entry.flags) && entry.flags.length > 0) {
    if (!entry.flags.every((f: string) => isFlagEnabled(f))) return false
  }
  return true
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function createAuthMiddleware(endpoint: any, api: any, operational: any) {
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const rule = (operational.rules ?? []).find(
    (r: any) => r.capability === capability && r.type === 'access',
  )
  const allowEntries: any[] = rule?.allow ?? []
  const requiresOwnership = allowEntries.some((a: any) => a.ownership)
  const hasAllow = allowEntries.length > 0

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      // Skip auth in development when no token is provided
      if (process.env.NODE_ENV !== 'production') return next()
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token)
      ;(req as any).user = payload

      // Role + flag check — at least one allow entry must match.
      if (hasAllow) {
        const roleClaim = authConfig?.roleClaim ?? 'roles'
        const userRoles: string[] = (payload[roleClaim] as string[]) ?? []
        if (!allowEntries.some((entry: any) => entryMatches(entry, userRoles))) {
          return res.status(403).json({ message: 'Forbidden' })
        }
      }

      // Ownership flag — attach to request for handler-level enforcement
      if (requiresOwnership) {
        ;(req as any).requiresOwnership = true
      }

      next()
    } catch {
      return res.status(401).json({ message: 'Unauthorized' })
    }
  }
}
`
}

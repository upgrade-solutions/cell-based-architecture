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
// The authz hook imports { isFlagEnabled } from './flags'.

export function isFlagEnabled(name: string): boolean {
  const envName = 'FLAG_' + name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const raw = process.env[envName]
  return raw === '1' || raw === 'true'
}
`
}

function generateBuiltInAuth(): string {
  return `import { FastifyRequest, FastifyReply } from 'fastify'
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

// ── Hook factory (Fastify preHandler) ────────────────────────────────────────
//
// allowsAnonymous: true iff the access rule includes at least one allow entry
// that grants the "public" pseudo-role with no ownership constraint and no
// feature-flag gate. Public-with-ownership (e.g. {role: "public", ownership:
// true}) means "an authenticated user can access their own resource" — that
// still requires a token, so it does NOT make the endpoint anonymous.

export function createAuthHook(endpoint: any, api: any, core: any) {
  const rule = (core.rules ?? []).find(
    (r: any) => r.operation === endpoint.operation && r.type === 'access',
  )
  const allowEntries: any[] = rule?.allow ?? []
  const requiresOwnership = allowEntries.some((a: any) => a.ownership)
  const hasAllow = allowEntries.length > 0
  const allowsAnonymous = allowEntries.some(
    (a: any) =>
      a.role === 'public' && !a.ownership && !(Array.isArray(a.flags) && a.flags.length > 0),
  )

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      if (allowsAnonymous) return
      reply.code(401).send({ message: 'Unauthorized' })
      return reply
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token)
      ;(req as any).user = payload

      // Role + flag check — at least one allow entry must match.
      if (hasAllow && !allowsAnonymous) {
        const userRoles: string[] = (payload.roles as string[]) ?? []
        if (!allowEntries.some((entry: any) => entryMatches(entry, userRoles))) {
          reply.code(403).send({ message: 'Forbidden' })
          return reply
        }
      }

      if (requiresOwnership) {
        ;(req as any).requiresOwnership = true
      }
    } catch {
      if (allowsAnonymous) return
      reply.code(401).send({ message: 'Unauthorized' })
      return reply
    }
  }
}
`
}

function generateOidcAuth(): string {
  return `import { FastifyRequest, FastifyReply } from 'fastify'
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

function entryMatches(entry: any, userRoles: string[]): boolean {
  if (entry.role && !userRoles.includes(entry.role)) return false
  if (Array.isArray(entry.flags) && entry.flags.length > 0) {
    if (!entry.flags.every((f: string) => isFlagEnabled(f))) return false
  }
  return true
}

export function createAuthHook(endpoint: any, api: any, core: any) {
  const rule = (core.rules ?? []).find(
    (r: any) => r.operation === endpoint.operation && r.type === 'access',
  )
  const allowEntries: any[] = rule?.allow ?? []
  const requiresOwnership = allowEntries.some((a: any) => a.ownership)
  const hasAllow = allowEntries.length > 0
  const allowsAnonymous = allowEntries.some(
    (a: any) =>
      a.role === 'public' && !a.ownership && !(Array.isArray(a.flags) && a.flags.length > 0),
  )

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      if (allowsAnonymous) return
      reply.code(401).send({ message: 'Unauthorized' })
      return reply
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token)
      ;(req as any).user = payload

      if (hasAllow && !allowsAnonymous) {
        const roleClaim = authConfig?.roleClaim ?? 'roles'
        const userRoles: string[] = (payload[roleClaim] as string[]) ?? []
        if (!allowEntries.some((entry: any) => entryMatches(entry, userRoles))) {
          reply.code(403).send({ message: 'Forbidden' })
          return reply
        }
      }

      if (requiresOwnership) {
        ;(req as any).requiresOwnership = true
      }
    } catch {
      if (allowsAnonymous) return
      reply.code(401).send({ message: 'Unauthorized' })
      return reply
    }
  }
}
`
}

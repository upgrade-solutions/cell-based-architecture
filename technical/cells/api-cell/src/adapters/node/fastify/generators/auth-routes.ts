/**
 * Generates /auth/login and /auth/me endpoints for built-in JWT auth as a
 * Fastify plugin. The express variant uses an Express Router; here we export
 * an async function that registers the same routes onto a Fastify instance.
 *
 * Demo user loading + bcrypt hashing semantics match the express adapter
 * exactly — DEMO_USERS_JSON env var, fail-closed with 503 if missing or
 * malformed, no plaintext passwords retained after boot.
 */
export function generateAuthRoutes(): string {
  return `import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as jwt from 'jsonwebtoken'
import * as bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

interface DemoUser {
  email: string
  password: string // bcrypt hash, set at load time
  roles: string[]
}

function loadUsers(): DemoUser[] {
  const raw = process.env.DEMO_USERS_JSON
  if (!raw) {
    console.warn('[auth] DEMO_USERS_JSON not set — /auth/login disabled')
    return []
  }
  try {
    const parsed = JSON.parse(raw) as Array<{ email: string; password: string; roles: string[] }>
    if (!Array.isArray(parsed)) throw new Error('expected an array of user objects')
    const users: DemoUser[] = parsed.map((u) => ({
      email: u.email,
      password: bcrypt.hashSync(u.password, 10),
      roles: u.roles ?? [],
    }))
    console.log(\`[auth] Loaded \${users.length} user(s) from DEMO_USERS_JSON\`)
    return users
  } catch (err: any) {
    console.error(\`[auth] DEMO_USERS_JSON is malformed: \${err.message} — /auth/login disabled\`)
    return []
  }
}

const USERS = loadUsers()

interface LoginBody {
  email?: string
  password?: string
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    if (USERS.length === 0) {
      return reply.code(503).send({ message: 'Authentication not configured' })
    }

    const { email, password } = req.body ?? {}
    if (!email || !password) {
      return reply.code(400).send({ message: 'Email and password are required' })
    }

    const user = USERS.find(u => u.email === email)
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return reply.code(401).send({ message: 'Invalid email or password' })
    }

    const token = jwt.sign(
      { sub: user.email, email: user.email, roles: user.roles },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' },
    )

    return reply.send({ token, user: { email: user.email, roles: user.roles } })
  })

  app.get('/auth/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ message: 'Unauthorized' })
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET, { algorithms: ['HS256'] }) as any
      return reply.send({ email: payload.email, roles: payload.roles })
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' })
    }
  })
}
`
}

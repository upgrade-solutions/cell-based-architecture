/**
 * Generates /auth/login and /auth/me endpoints for built-in JWT auth.
 *
 * User credentials load from DEMO_USERS_JSON at startup — a JSON array of
 * { email, password, roles } entries, with password in plaintext (hashed
 * in-memory via bcrypt on boot). If the env var is missing or malformed,
 * /auth/login fails closed with 503 and no users are loaded. This keeps
 * demo passwords out of the shipped source — in dev, docker-compose
 * provides a default DEMO_USERS_JSON; in prod, the operator provisions
 * it (e.g. via AWS Secrets Manager → ECS secrets reference).
 */
export function generateAuthRoutes(): string {
  return `import { Router, Request, Response } from 'express'
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

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  if (USERS.length === 0) {
    return res.status(503).json({ message: 'Authentication not configured' })
  }

  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const user = USERS.find(u => u.email === email)
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const token = jwt.sign(
    { sub: user.email, email: user.email, roles: user.roles },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' },
  )

  res.json({ token, user: { email: user.email, roles: user.roles } })
})

router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET, { algorithms: ['HS256'] }) as any
    res.json({ email: payload.email, roles: payload.roles })
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
})

export default router
`
}

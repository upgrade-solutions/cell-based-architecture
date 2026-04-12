/**
 * Generates /auth/login and /auth/me endpoints for built-in JWT auth.
 * Demo users are hardcoded with pre-computed bcrypt hashes.
 */
export function generateAuthRoutes(): string {
  return `import { Router, Request, Response } from 'express'
import * as jwt from 'jsonwebtoken'
import * as bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

// ── Demo users (pre-seeded) ─────────────────────────────────────────────────
const USERS = [
  { email: 'admin@marshall.demo', password: bcrypt.hashSync('demo123', 10), roles: ['admin'] },
  { email: 'staff@marshall.demo', password: bcrypt.hashSync('demo123', 10), roles: ['intake_staff'] },
  { email: 'attorney@marshall.demo', password: bcrypt.hashSync('demo123', 10), roles: ['attorney'] },
]

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
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

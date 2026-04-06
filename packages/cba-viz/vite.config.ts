import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Vite plugin that provides a POST /api/save-dna/:domain endpoint
 * for writing architecture.json changes back to disk during dev.
 */
function saveDnaPlugin() {
  return {
    name: 'save-dna',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/save-dna\/(\w+)$/)
        if (req.method === 'POST' && match) {
          const domain = match[1]
          let body = ''
          req.on('data', (chunk: string) => { body += chunk })
          req.on('end', () => {
            try {
              const dnaDir = path.resolve(__dirname, '../../dna', domain)
              const filePath = path.join(dnaDir, 'architecture.json')
              if (!fs.existsSync(dnaDir)) {
                res.statusCode = 404
                res.end(JSON.stringify({ error: `Domain "${domain}" not found` }))
                return
              }
              fs.writeFileSync(filePath, body + '\n', 'utf-8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(err) }))
            }
          })
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    saveDnaPlugin(),
  ],
  server: {
    port: 5174,
  },
})

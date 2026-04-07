import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'

/**
 * Vite plugin that provides a POST /api/save-views/:domain endpoint
 * for merging updated views back into technical.json during dev.
 */
function saveViewsPlugin() {
  return {
    name: 'save-views',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // GET /api/load-views/:domain — read views from technical.json
        const loadMatch = req.url?.match(/^\/api\/load-views\/(\w+)$/)
        if (req.method === 'GET' && loadMatch) {
          try {
            const domain = loadMatch[1]
            const filePath = path.resolve(__dirname, '../../dna', domain, 'technical.json')
            if (!fs.existsSync(filePath)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: `technical.json not found for domain "${domain}"` }))
              return
            }
            const technical = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ views: technical.views ?? [] }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err) }))
          }
          return
        }

        // POST /api/save-views/:domain — merge views back into technical.json
        const match = req.url?.match(/^\/api\/save-views\/(\w+)$/)
        if (req.method === 'POST' && match) {
          const domain = match[1]
          let body = ''
          req.on('data', (chunk: string) => { body += chunk })
          req.on('end', () => {
            try {
              const dnaDir = path.resolve(__dirname, '../../dna', domain)
              const filePath = path.join(dnaDir, 'technical.json')
              if (!fs.existsSync(filePath)) {
                res.statusCode = 404
                res.end(JSON.stringify({ error: `technical.json not found for domain "${domain}"` }))
                return
              }
              const technical = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
              technical.views = JSON.parse(body)
              fs.writeFileSync(filePath, JSON.stringify(technical, null, 2) + '\n', 'utf-8')
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
        // GET /api/status/:domain — probe Docker for running containers (async)
        const statusMatch = req.url?.match(/^\/api\/status\/(\w+)$/)
        if (req.method === 'GET' && statusMatch) {
          const domain = statusMatch[1]
          probeDockerStatusAsync(domain).then((statuses) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(statuses))
          }).catch(() => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({}))
          })
          return
        }

        next()
      })
    },
  }
}

/**
 * Probe Docker for running/stopped containers and map them to DNA node IDs.
 * Async — does not block the Vite dev server event loop.
 */
function probeDockerStatusAsync(domain: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    exec(
      'docker ps -a --format "{{.Names}}\\t{{.State}}\\t{{.Labels}}"',
      { encoding: 'utf-8', timeout: 5000 },
      (err, stdout) => {
        if (err) { reject(err); return }

        const containers = (stdout ?? '').trim().split('\n').filter(Boolean).map((line) => {
          const [name, state, labels] = line.split('\t')
          return { name: name ?? '', state: state ?? '', labels: labels ?? '' }
        })

        const techPath = path.resolve(__dirname, '../../dna', domain, 'technical.json')
        if (!fs.existsSync(techPath)) { resolve({}); return }
        const technical = JSON.parse(fs.readFileSync(techPath, 'utf-8'))
        const views = technical.views ?? []
        const allNodeIds: string[] = []
        for (const view of views) {
          for (const node of view.nodes ?? []) {
            allNodeIds.push(node.id)
          }
        }

        const result: Record<string, string> = {}

        for (const nodeId of allNodeIds) {
          const svcName = nodeId.replace(/-cell/g, '').replace(/^-|-$/g, '') || nodeId

          for (const c of containers) {
            if (c.labels.includes(`cba.node=${nodeId}`)) {
              result[nodeId] = c.state === 'running' ? 'running' : 'deployed'
              break
            }
            const cName = c.name.toLowerCase()
            if (
              cName.includes(domain) &&
              (cName.includes(nodeId) || cName.includes(svcName))
            ) {
              result[nodeId] = c.state === 'running' ? 'running' : 'deployed'
              break
            }
            if (cName === svcName || cName === nodeId || cName.endsWith(`-${svcName}`) || cName.endsWith(`-${nodeId}`)) {
              result[nodeId] = c.state === 'running' ? 'running' : 'deployed'
              break
            }
          }
        }

        resolve(result)
      },
    )
  })
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    saveViewsPlugin(),
  ],
  server: {
    port: 5174,
    fs: {
      allow: [
        // Allow serving files from the repo root (for dna/ imports)
        path.resolve(__dirname, '../..'),
      ],
    },
  },
})

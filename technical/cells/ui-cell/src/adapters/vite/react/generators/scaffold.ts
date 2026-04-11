export function generatePackageJson(appName: string): string {
  return JSON.stringify(
    {
      name: appName,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.0',
        'react-dom': '^18.3.0',
        'react-router-dom': '^6.24.0',
        'xstate': '^5.18.0',
        '@xstate/react': '^4.1.0',
        '@radix-ui/react-avatar': '^1.1.0',
        '@radix-ui/react-collapsible': '^1.1.0',
        '@radix-ui/react-dialog': '^1.1.0',
        '@radix-ui/react-dropdown-menu': '^2.1.0',
        '@radix-ui/react-tooltip': '^1.1.0',
        'class-variance-authority': '^0.7.0',
        'clsx': '^2.1.0',
        'tailwind-merge': '^2.5.0',
        'survey-core': '^1.12.0',
        'survey-react-ui': '^1.12.0',
      },
      devDependencies: {
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.0',
        typescript: '^5.4.0',
        vite: '^5.3.0',
        'tailwindcss': '^4.1.0',
        '@tailwindcss/vite': '^4.1.0',
      },
    },
    null,
    2
  ) + '\n'
}

export function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    },
    null,
    2
  ) + '\n'
}

export function generateTsConfigNode(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
      },
      include: ['vite.config.ts'],
    },
    null,
    2
  ) + '\n'
}

export function generateViteConfig(appName: string, dnaRelPath = '../../dna', apiProxyTarget?: string): string {
  const proxyBlock = apiProxyTarget
    ? `
    proxy: {
      '/lending': {
        target: '${apiProxyTarget}',
        changeOrigin: true,
      },
    },`
    : ''

  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'dna-static',
      configureServer(server) {
        const dnaDir = path.resolve(__dirname, '${dnaRelPath}')
        server.middlewares.use('/dna', (req, res, next) => {
          const file = path.join(dnaDir, req.url ?? '')
          if (fs.existsSync(file) && file.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(fs.readFileSync(file, 'utf-8'))
          } else {
            next()
          }
        })
      },
    },
  ],
  build: { outDir: 'dist' },
  server: {
    port: 5173,
    allowedHosts: true,${proxyBlock}
  },
  define: { __APP_NAME__: JSON.stringify('${appName}') },
})
`
}

export function generateIndexHtml(appName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
}

export function generateMain(): string {
  return `import './globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './renderer/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`
}

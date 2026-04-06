export function generatePackageJson(appName: string): string {
  return JSON.stringify(
    {
      name: appName,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vue-tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        vue: '^3.4.0',
        'vue-router': '^4.3.0',
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^5.0.0',
        typescript: '^5.4.0',
        'vue-tsc': '^2.0.0',
        vite: '^5.3.0',
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
        module: 'ESNext',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'preserve',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src/**/*.ts', 'src/**/*.vue', 'env.d.ts'],
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

export function generateEnvDts(): string {
  return `/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
`
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
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    vue(),
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
    port: 5174,
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
    <style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; }</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}

export function generateMain(): string {
  return `import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './renderer/App.vue'

// Start with an empty router — routes are added dynamically in App.vue
// after DNA is fetched, because route definitions depend on DNA content.
const router = createRouter({
  history: createWebHistory(),
  routes: [],
})

createApp(App).use(router).mount('#app')
`
}

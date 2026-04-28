import { ComputeTarget } from '..'

export function generatePackageJson(appName: string, compute: ComputeTarget = 'ecs'): string {
  // Fastify 5 + v5-aligned plugin majors. Mixing v4 and v5 plugins against any
  // single fastify install throws FST_ERR_PLUGIN_VERSION_MISMATCH at startup,
  // so the fastify-* deps must move in lockstep.
  //
  // Docs are served by a hand-rolled Redoc HTML page in main.ts, loading the
  // Redoc bundle from CDN. We deliberately do NOT carry `@fastify/swagger` or
  // `@fastify/swagger-ui` — the api-cell builds the OpenAPI doc directly from
  // DNA, so the plugin pair would be dead weight, and `@fastify/swagger-ui@^5`
  // also force-routes its own spec URL through `app.swagger()`, which broke
  // Swagger UI rendering against the v9/v5 plugin pair. See the comment on
  // `generateMain` for the full rationale.
  const baseDeps: Record<string, string> = {
    '@fastify/cors': '^11.0.0',
    bcryptjs: '^2.4.0',
    dotenv: '^16.0.0',
    'drizzle-orm': '^0.30.0',
    fastify: '^5.0.0',
    jsonwebtoken: '^9.0.0',
    'jwks-rsa': '^3.1.0',
    pg: '^8.11.0',
  }

  // @fastify/aws-lambda v5 is the line aligned with fastify@5 (v4 was the
  // fastify@4 line). Streamified-response support is present from v4 onward,
  // so v5 retains the SSE-through-Lambda-Function-URL behavior the lambda
  // entrypoint relies on.
  const lambdaDeps: Record<string, string> = {
    '@fastify/aws-lambda': '^5.0.0',
  }

  const dependencies =
    compute === 'lambda'
      ? { ...baseDeps, ...lambdaDeps }
      : baseDeps

  // Build script differs: ECS keeps the `cp dna` step the express adapter uses;
  // Lambda must also produce a zip artifact terraform packs into the function.
  const buildScript =
    compute === 'lambda'
      ? "tsc && node -e \"require('fs').cpSync('src/dna','dist/dna',{recursive:true})\" && node -e \"require('fs').cpSync('node_modules','dist/node_modules',{recursive:true})\""
      : "tsc && node -e \"require('fs').cpSync('src/dna','dist/dna',{recursive:true})\""

  const scripts: Record<string, string> = {
    build: buildScript,
    'db:generate': 'drizzle-kit generate',
    'db:migrate': 'drizzle-kit migrate',
    'db:seed': 'ts-node src/seed.ts',
  }

  if (compute === 'lambda') {
    // Lambda has no `start` — it's invoked by the runtime via the exported
    // handler. `package` zips the build output for terraform to pick up.
    scripts.package = 'cd dist && zip -r ../lambda.zip .'
  } else {
    scripts.start = 'node dist/main.js'
    scripts['start:dev'] = 'ts-node src/main.ts'
  }

  return JSON.stringify(
    {
      name: appName,
      version: '0.0.1',
      scripts,
      dependencies,
      devDependencies: {
        '@types/bcryptjs': '^2.4.0',
        '@types/jsonwebtoken': '^9.0.0',
        '@types/node': '^20.0.0',
        '@types/pg': '^8.10.0',
        'drizzle-kit': '^0.21.0',
        'ts-node': '^10.9.0',
        typescript: '^5.4.0',
      },
    },
    null,
    2,
  ) + '\n'
}

export function generateTsConfig(): string {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020'],
          outDir: './dist',
          rootDir: './src',
          strict: false,
          esModuleInterop: true,
          resolveJsonModule: true,
          skipLibCheck: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist', 'drizzle', 'drizzle.config.ts'],
      },
      null,
      2,
    ) + '\n'
  )
}

export function generateEnv(): string {
  return `PORT=3001
# Uncomment to use Postgres instead of in-memory store:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lending
`
}

import { ComputeTarget } from '..'

export function generatePackageJson(appName: string, compute: ComputeTarget = 'ecs'): string {
  const baseDeps: Record<string, string> = {
    '@fastify/cors': '^9.0.0',
    '@fastify/swagger': '^9.0.0',
    '@fastify/swagger-ui': '^4.0.0',
    bcryptjs: '^2.4.0',
    dotenv: '^16.0.0',
    'drizzle-orm': '^0.30.0',
    fastify: '^4.28.0',
    jsonwebtoken: '^9.0.0',
    'jwks-rsa': '^3.1.0',
    pg: '^8.11.0',
  }

  // @fastify/aws-lambda v4+ ships streamifyResponse support — required for SSE
  // through Lambda Function URLs with invoke_mode = RESPONSE_STREAM.
  const lambdaDeps: Record<string, string> = {
    '@fastify/aws-lambda': '^4.1.0',
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

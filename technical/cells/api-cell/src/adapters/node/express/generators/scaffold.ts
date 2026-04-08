export function generatePackageJson(appName: string): string {
  return JSON.stringify(
    {
      name: appName,
      version: '0.0.1',
      scripts: {
        build: "tsc && node -e \"require('fs').cpSync('src/dna','dist/dna',{recursive:true})\"",
        start: 'node dist/main.js',
        'start:dev': 'ts-node src/main.ts',
        'db:generate': 'drizzle-kit generate',
        'db:migrate': 'drizzle-kit migrate',
        'db:seed': 'ts-node src/seed.ts',
      },
      dependencies: {
        cors: '^2.8.5',
        dotenv: '^16.0.0',
        'drizzle-orm': '^0.30.0',
        express: '^4.18.0',
        jsonwebtoken: '^9.0.0',
        'jwks-rsa': '^3.1.0',
        pg: '^8.11.0',
        'swagger-ui-express': '^5.0.0',
        amqplib: '^0.10.0',
      },
      devDependencies: {
        '@types/cors': '^2.8.0',
        '@types/express': '^4.17.0',
        '@types/jsonwebtoken': '^9.0.0',
        '@types/node': '^20.0.0',
        '@types/pg': '^8.10.0',
        '@types/swagger-ui-express': '^4.1.0',
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

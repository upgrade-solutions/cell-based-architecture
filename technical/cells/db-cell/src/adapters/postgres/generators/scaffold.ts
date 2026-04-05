import { DbAdapterConfig } from '../../../types'

export function generatePackageJson(dbName: string): string {
  return JSON.stringify(
    {
      name: `${dbName}-db`,
      version: '0.0.1',
      scripts: {
        'db:generate': 'drizzle-kit generate',
        'db:migrate': 'drizzle-kit migrate',
        'db:seed': 'ts-node src/seed.ts',
      },
      dependencies: {
        dotenv: '^16.0.0',
        'drizzle-orm': '^0.30.0',
        pg: '^8.11.0',
      },
      devDependencies: {
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
      },
      null,
      2,
    ) + '\n'
  )
}

export function generateEnv(config: DbAdapterConfig): string {
  const role = config.app_role ?? `${config.database}_app`
  const password = config.app_password ?? role
  const port = config.port ?? 5433

  return `DATABASE_URL=postgresql://${role}:${password}@localhost:${port}/${config.database}
`
}

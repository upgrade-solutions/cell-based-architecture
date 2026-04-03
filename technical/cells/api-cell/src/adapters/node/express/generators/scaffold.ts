export function generatePackageJson(appName: string): string {
  return JSON.stringify(
    {
      name: appName,
      version: '0.0.1',
      scripts: {
        build: 'tsc',
        start: 'node dist/main.js',
        'start:dev': 'ts-node src/main.ts',
      },
      dependencies: {
        cors: '^2.8.5',
        express: '^4.18.0',
        jsonwebtoken: '^9.0.0',
        'swagger-ui-express': '^5.0.0',
      },
      devDependencies: {
        '@types/cors': '^2.8.0',
        '@types/express': '^4.17.0',
        '@types/jsonwebtoken': '^9.0.0',
        '@types/node': '^20.0.0',
        '@types/swagger-ui-express': '^4.1.0',
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

export function generateEnv(): string {
  return `PORT=3000\n`
}

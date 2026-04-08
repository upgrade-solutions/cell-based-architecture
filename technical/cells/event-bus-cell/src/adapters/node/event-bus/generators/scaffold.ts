/**
 * Generates the package.json and tsconfig.json for the event bus output.
 */
export function generatePackageJson(name: string): string {
  const pkg = {
    name,
    version: '0.0.1',
    private: true,
    scripts: {
      start: 'ts-node src/subscriber.ts',
      build: 'tsc',
    },
    dependencies: {},
    devDependencies: {
      'typescript': '^5.4.0',
      'ts-node': '^10.9.0',
      '@types/node': '^20.0.0',
    },
  }
  return JSON.stringify(pkg, null, 2)
}

export function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      declaration: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }
  return JSON.stringify(config, null, 2)
}

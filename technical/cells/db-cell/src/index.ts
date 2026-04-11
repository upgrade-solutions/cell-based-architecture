import { run } from './run'

// CLI: db-cell <technical.json> <cell-name> <output-dir>
if (require.main === module) {
  const [, , technicalPath, cellName, outputDir] = process.argv
  if (!technicalPath || !cellName || !outputDir) {
    console.error('Usage: db-cell <path-to-technical.json> <cell-name> <output-dir>')
    process.exit(1)
  }
  try {
    run(technicalPath, cellName, outputDir)
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}

export { run } from './run'
export type { ProductCoreDNA, DbCellAdapter } from './types'

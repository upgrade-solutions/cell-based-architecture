import * as fs from 'fs'
import * as path from 'path'

/**
 * Resolve the repo root by walking up from cwd looking for a `dna/` directory
 * adjacent to a workspace `package.json`.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir)
  while (true) {
    const hasDna = fs.existsSync(path.join(dir, 'dna'))
    const hasPkg = fs.existsSync(path.join(dir, 'package.json'))
    if (hasDna && hasPkg) return dir
    const parent = path.dirname(dir)
    if (parent === dir) {
      throw new Error(
        'Could not locate cell-based-architecture repo root (no `dna/` directory found walking up from cwd).',
      )
    }
    dir = parent
  }
}

export type Layer = 'operational' | 'product.api' | 'product.ui' | 'technical' | 'architecture'

export const LAYERS: Layer[] = ['operational', 'product.api', 'product.ui', 'technical', 'architecture']

export interface DomainPaths {
  root: string
  domain: string
  dir: string
  files: Record<Layer, string>
}

export function resolveDomain(domain: string, root: string = findRepoRoot()): DomainPaths {
  const dir = path.join(root, 'dna', domain)
  if (!fs.existsSync(dir)) {
    throw new Error(`Domain not found: ${domain} (expected at ${dir})`)
  }
  return {
    root,
    domain,
    dir,
    files: {
      operational: path.join(dir, 'operational.json'),
      'product.api': path.join(dir, 'product.api.json'),
      'product.ui': path.join(dir, 'product.ui.json'),
      technical: path.join(dir, 'technical.json'),
      architecture: path.join(dir, 'architecture.json'),
    },
  }
}

export function loadLayer(paths: DomainPaths, layer: Layer): any {
  const file = paths.files[layer]
  if (!fs.existsSync(file)) {
    throw new Error(`Layer file missing: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

export function saveLayer(paths: DomainPaths, layer: Layer, doc: any): void {
  const file = paths.files[layer]
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
}

export function listDomains(root: string = findRepoRoot()): string[] {
  const dnaDir = path.join(root, 'dna')
  if (!fs.existsSync(dnaDir)) return []
  return fs
    .readdirSync(dnaDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

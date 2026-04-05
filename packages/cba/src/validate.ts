import { DnaValidator } from '@cell/dna-validator'
import { Layer, LAYERS, resolveDomain, loadLayer } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { VALIDATE_HELP } from './help'

const SCHEMA_IDS: Record<Layer, string> = {
  operational: 'operational',
  'product.api': 'product/api',
  'product.ui': 'product/ui',
  technical: 'technical',
}

interface LayerResult {
  layer: Layer
  valid: boolean
  errors: Array<{ path: string; message: string | undefined }>
}

export function runValidate(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(VALIDATE_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba validate <domain> [--layer <layer>]', opts)
    process.exit(1)
  }

  const layerFilter = flag(args, 'layer') as Layer | undefined
  if (layerFilter && !LAYERS.includes(layerFilter)) {
    emitError(`Unknown layer: "${layerFilter}". Valid: ${LAYERS.join(', ')}`, opts)
    process.exit(1)
  }

  const targetLayers = layerFilter ? [layerFilter] : LAYERS
  let paths
  try {
    paths = resolveDomain(domain)
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  const validator = new DnaValidator()
  const results: LayerResult[] = []
  for (const layer of targetLayers) {
    const doc = loadLayer(paths, layer)
    const r = validator.validate(doc, SCHEMA_IDS[layer])
    results.push({
      layer,
      valid: r.valid,
      errors: r.errors.map((e) => ({ path: e.instancePath || '/', message: e.message })),
    })
  }

  const allValid = results.every((r) => r.valid)

  // Cross-layer checks (lightweight)
  const crossLayerErrors = !layerFilter ? crossLayerValidate(paths) : []

  const summary = {
    ok: allValid && crossLayerErrors.length === 0,
    domain,
    layers: results,
    crossLayerErrors,
  }

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    for (const r of results) {
      if (r.valid) {
        console.log(`✓ ${r.layer}`)
      } else {
        console.error(`✗ ${r.layer}`)
        for (const e of r.errors) console.error(`    ${e.path} ${e.message}`)
      }
    }
    if (crossLayerErrors.length > 0) {
      console.error(`✗ cross-layer`)
      for (const e of crossLayerErrors) console.error(`    ${e.message}`)
    } else if (!layerFilter) {
      console.log(`✓ cross-layer`)
    }
  }

  if (!summary.ok) process.exit(1)
}

function crossLayerValidate(paths: ReturnType<typeof resolveDomain>): Array<{ message: string }> {
  const errors: Array<{ message: string }> = []
  let operational: any, productApi: any, technical: any
  try {
    operational = loadLayer(paths, 'operational')
  } catch {
    return errors
  }
  try {
    productApi = loadLayer(paths, 'product.api')
  } catch {
    /* optional */
  }
  try {
    technical = loadLayer(paths, 'technical')
  } catch {
    /* optional */
  }

  // Collect operational nouns (tree-walked)
  const nounNames = new Set<string>()
  const walk = (node: any): void => {
    if (!node) return
    for (const n of node.nouns ?? []) nounNames.add(n.name)
    for (const d of node.domains ?? []) walk(d)
  }
  walk(operational.domain)

  // product.api → Resource.noun must reference an operational Noun
  if (productApi) {
    for (const r of productApi.resources ?? []) {
      if (r.noun && !nounNames.has(r.noun)) {
        errors.push({
          message: `product.api Resource "${r.name}" references unknown operational Noun "${r.noun}"`,
        })
      }
    }
  }

  // technical → cell.dna must point at a real DNA layer file (domain/layer format)
  if (technical) {
    for (const c of technical.cells ?? []) {
      if (!c.dna) continue
      // "lending/operational", "lending/product.api" — we can't fully verify without scanning,
      // but we can at least flag malformed values
      if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(c.dna)) {
        errors.push({
          message: `technical Cell "${c.name}" has malformed dna reference "${c.dna}" (expected <domain>/<layer>)`,
        })
      }
    }
  }

  return errors
}

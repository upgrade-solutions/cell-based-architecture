import * as fs from 'fs'
import { DnaValidator } from '@dna/validator'
import { Layer, LAYERS, resolveDomain, loadLayer } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { VALIDATE_HELP } from './help'

const SCHEMA_IDS: Record<Layer, string> = {
  operational: 'operational',
  'product.core': 'product/core',
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
    // product.core is optional — it is a derived artifact; skip if absent
    if (layer === 'product.core' && !fs.existsSync(paths.files['product.core'])) {
      continue
    }
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
  let operational: any, productCore: any, productApi: any, productUi: any, technical: any
  try {
    operational = loadLayer(paths, 'operational')
  } catch {
    return []
  }
  if (fs.existsSync(paths.files['product.core'])) {
    try {
      productCore = loadLayer(paths, 'product.core')
    } catch {
      /* optional */
    }
  }
  try {
    productApi = loadLayer(paths, 'product.api')
  } catch {
    /* optional */
  }
  try {
    productUi = loadLayer(paths, 'product.ui')
  } catch {
    /* optional */
  }
  try {
    technical = loadLayer(paths, 'technical')
  } catch {
    /* optional */
  }

  const validator = new DnaValidator()
  const result = validator.validateCrossLayer({ operational, productCore, productApi, productUi, technical })
  return result.errors.map((e) => ({ message: `[${e.layer}] ${e.path}: ${e.message}` }))
}

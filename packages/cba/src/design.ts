import * as fs from 'fs'
import * as path from 'path'
import { resolveSchemaFile as resolveDnaSchemaFile, DnaValidator } from '@dna-codes/dna-core'
import { Layer, LAYERS, resolveDomain, loadLayer, saveLayer } from './context'
import {
  PRIMITIVES,
  primitivesForLayer,
  findPrimitiveSpec,
  collectPrimitives,
  findDomainByPath,
  findNounByName,
  walkDomains,
} from './primitives'
import { ParsedArgs, flag, boolFlag } from './args'
import { emit, emitError, emitOk } from './output'
const VALID_COMMANDS = ['list', 'show', 'add', 'remove', 'schema', 'validate']

/**
 * Run a design command for a pre-determined layer.
 * argv = [command, domain, ...]
 */
export function runLayerCommand(layer: Layer, argv: string[], args: ParsedArgs): void {
  const json = boolFlag(args, 'json')
  const opts = { json }

  const [command, domain] = argv
  if (!command) {
    emitError(`Missing <command>. Valid: ${VALID_COMMANDS.join(', ')}`, opts)
    process.exit(1)
  }

  // `schema` does not need a domain
  if (command === 'schema') {
    cmdSchema(layer, argv[1], opts)
    return
  }

  if (!domain) {
    emitError(`Missing <domain>. Usage: cba ${layerCliName(layer)} ${command} <domain>`, opts)
    process.exit(1)
  }

  switch (command) {
    case 'list':
      cmdList(layer, domain, args, opts)
      return
    case 'show':
      cmdShow(layer, domain, args, opts)
      return
    case 'add':
      cmdAdd(layer, domain, args, opts)
      return
    case 'remove':
      cmdRemove(layer, domain, args, opts)
      return
    case 'validate':
      cmdValidateLayer(layer, domain, opts)
      return
    default:
      emitError(`Unknown command: "${command}". Valid: ${VALID_COMMANDS.join(', ')}`, opts)
      process.exit(1)
  }
}

function layerCliName(layer: Layer): string {
  switch (layer) {
    case 'operational': return 'operational'
    case 'product.core': return 'product core'
    case 'product.api': return 'product api'
    case 'product.ui': return 'product ui'
    case 'technical': return 'technical'
  }
}

function cmdList(layer: Layer, domain: string, args: ParsedArgs, opts: { json: boolean }): void {
  const typeFilter = flag(args, 'type')
  const paths = resolveDomain(domain)
  const doc = loadLayer(paths, layer)

  const specs = typeFilter
    ? primitivesForLayer(layer).filter((s) => s.type.toLowerCase() === typeFilter.toLowerCase())
    : primitivesForLayer(layer)

  if (typeFilter && specs.length === 0) {
    emitError(`Unknown primitive type "${typeFilter}" for layer "${layer}"`, opts, {
      validTypes: primitivesForLayer(layer).map((s) => s.type),
    })
    process.exit(1)
  }

  const results = specs.flatMap((spec) =>
    collectPrimitives(doc, spec).map((p) => ({
      type: p.type,
      name: p.name,
      domainPath: p.domainPath,
    })),
  )

  emit({ layer, domain, count: results.length, primitives: results }, opts, () => {
    if (results.length === 0) return `(no primitives found)`
    const lines = [`${layer} · ${domain} — ${results.length} primitive(s)`]
    const byType: Record<string, typeof results> = {}
    for (const r of results) (byType[r.type] ??= []).push(r)
    for (const [type, items] of Object.entries(byType)) {
      lines.push(``, `  ${type} (${items.length})`)
      for (const i of items) {
        const loc = i.domainPath ? `  [${i.domainPath}]` : ''
        lines.push(`    · ${i.name}${loc}`)
      }
    }
    return lines.join('\n')
  })
}

function cmdShow(layer: Layer, domain: string, args: ParsedArgs, opts: { json: boolean }): void {
  const type = flag(args, 'type')
  const name = flag(args, 'name')
  if (!type) {
    emitError('--type is required', opts)
    process.exit(1)
  }
  const spec = findPrimitiveSpec(layer, type)
  if (!spec) {
    emitError(`Unknown primitive type "${type}" for layer "${layer}"`, opts)
    process.exit(1)
  }

  const paths = resolveDomain(domain)
  const doc = loadLayer(paths, layer)
  const all = collectPrimitives(doc, spec!)

  // Singletons (Namespace, Layout) — return without --name
  if (spec!.singleton) {
    if (all.length === 0) {
      emitError(`${type} not found in ${layer}`, opts)
      process.exit(1)
    }
    emit(all[0].node, opts, () => JSON.stringify(all[0].node, null, 2))
    return
  }

  if (!name) {
    emitError('--name is required for this primitive', opts)
    process.exit(1)
  }

  const match = all.find((p) => p.name === name)
  if (!match) {
    emitError(`${type} "${name}" not found in ${layer} of ${domain}`, opts, {
      available: all.map((p) => p.name),
    })
    process.exit(1)
  }
  emit(match.node, opts, () => JSON.stringify(match.node, null, 2))
}

function cmdSchema(layer: Layer, type: string | undefined, opts: { json: boolean }): void {
  if (!type) {
    // List all primitives in the layer
    const specs = primitivesForLayer(layer)
    emit({ layer, primitives: specs.map((s) => s.type) }, opts, () =>
      [`${layer} primitives:`, ...specs.map((s) => `  · ${s.type}`)].join('\n'),
    )
    return
  }

  const spec = findPrimitiveSpec(layer, type)
  if (!spec) {
    emitError(`Unknown primitive type "${type}" for layer "${layer}"`, opts, {
      validTypes: primitivesForLayer(layer).map((s) => s.type),
    })
    process.exit(1)
  }

  // Load the JSON schema from the corresponding schemas directory
  const schemaFile = findSchemaFile(spec!.type, spec!.layer)
  if (!schemaFile) {
    emitError(`Schema file not found for ${spec!.type}`, opts)
    process.exit(1)
  }
  const schemaDoc = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'))
  emit(schemaDoc, opts, () => JSON.stringify(schemaDoc, null, 2))
}

function findSchemaFile(type: string, layer: Layer): string | undefined {
  const lowerType = type.toLowerCase()

  const candidates: (string | null)[] = []
  if (layer === 'operational') {
    candidates.push(resolveDnaSchemaFile('operational', lowerType))
  } else if (layer === 'product.core') {
    candidates.push(resolveDnaSchemaFile('product', `core/${lowerType}`))
  } else if (layer === 'product.api') {
    candidates.push(
      resolveDnaSchemaFile('product', `api/${lowerType}`),
      // Fallback for shapes shared with product/core (e.g. Resource)
      resolveDnaSchemaFile('product', `core/${lowerType}`),
    )
  } else if (layer === 'product.ui') {
    candidates.push(resolveDnaSchemaFile('product', `web/${lowerType}`))
  } else if (layer === 'technical') {
    candidates.push(resolveDnaSchemaFile('technical', lowerType))
  }
  return candidates.find((c): c is string => !!c)
}

function cmdAdd(layer: Layer, domain: string, args: ParsedArgs, opts: { json: boolean }): void {
  const type = flag(args, 'type')
  const file = flag(args, 'file')
  const at = flag(args, 'at')
  if (!type || !file) {
    emitError('--type and --file are required', opts)
    process.exit(1)
  }

  const spec = findPrimitiveSpec(layer, type)
  if (!spec) {
    emitError(`Unknown primitive type "${type}" for layer "${layer}"`, opts)
    process.exit(1)
  }

  const primitiveJson = JSON.parse(fs.readFileSync(path.resolve(file), 'utf-8'))
  if (!primitiveJson.name && !spec!.singleton) {
    emitError(`Primitive JSON must include a "name" field`, opts)
    process.exit(1)
  }

  const paths = resolveDomain(domain)
  const doc = loadLayer(paths, layer)

  if (spec!.nested && spec!.childOf === 'noun') {
    // Action / Attribute on a Resource/Person/Role/Group — needs --at <domain-path>:<noun-name>
    const [dpath, nounName] = (at ?? '').split(':')
    if (!dpath || !nounName) {
      emitError(`--at must be <domain-path>:<noun-name> for ${spec!.type} (e.g. acme.finance.lending:Loan)`, opts)
      process.exit(1)
    }
    const found = findNounByName(doc.domain, dpath, nounName)
    if (!found) { emitError(`Noun "${nounName}" not found at ${dpath}`, opts); process.exit(1) }
    const key = spec!.location.endsWith('.actions') ? 'actions' : 'attributes'
    found.noun[key] ??= []
    if (found.noun[key].some((i: any) => i.name === primitiveJson.name)) {
      emitError(`${spec!.type} "${primitiveJson.name}" already exists at ${at}`, opts); process.exit(1)
    }
    found.noun[key].push(primitiveJson)
  } else if (spec!.nested && spec!.location.startsWith('domain.*')) {
    // Resource / Person / Role / Group — --at <domain-path>
    if (!at) {
      emitError(`--at <domain-path> is required for ${spec!.type}`, opts)
      process.exit(1)
    }
    const target = findDomainByPath(doc.domain, at)
    if (!target) { emitError(`Domain path not found: "${at}"`, opts); process.exit(1) }
    const field = spec!.location.split('.').pop()! // resources | persons | roles | groups
    target[field] ??= []
    if (target[field].some((i: any) => i.name === primitiveJson.name)) {
      emitError(`${spec!.type} "${primitiveJson.name}" already exists at ${at}`, opts); process.exit(1)
    }
    target[field].push(primitiveJson)
  } else if (spec!.singleton) {
    doc[spec!.location] = primitiveJson
  } else {
    doc[spec!.location] ??= []
    if (doc[spec!.location].some((i: any) => i.name === primitiveJson.name)) {
      emitError(`${spec!.type} "${primitiveJson.name}" already exists in ${layer}`, opts)
      process.exit(1)
    }
    doc[spec!.location].push(primitiveJson)
  }

  saveLayer(paths, layer, doc)
  emitOk(
    { layer, type: spec!.type, name: primitiveJson.name ?? spec!.type, file: paths.files[layer] },
    opts,
    () => `✓ Added ${spec!.type} "${primitiveJson.name ?? spec!.type}" to ${layer} (${domain})`,
  )
}

function cmdRemove(layer: Layer, domain: string, args: ParsedArgs, opts: { json: boolean }): void {
  const type = flag(args, 'type')
  const name = flag(args, 'name')
  if (!type || !name) {
    emitError('--type and --name are required', opts)
    process.exit(1)
  }

  const spec = findPrimitiveSpec(layer, type)
  if (!spec) {
    emitError(`Unknown primitive type "${type}" for layer "${layer}"`, opts)
    process.exit(1)
  }

  const paths = resolveDomain(domain)
  const doc = loadLayer(paths, layer)
  let removed = false

  if (spec!.nested && spec!.childOf === 'noun') {
    // Action / Attribute removal — sweep all noun primitives
    const childKey = spec!.location.endsWith('.actions') ? 'actions' : 'attributes'
    walkDomains(doc.domain, (node) => {
      for (const nounField of ['resources', 'persons', 'roles', 'groups']) {
        for (const noun of node[nounField] ?? []) {
          const idx = (noun[childKey] ?? []).findIndex((i: any) => i.name === name)
          if (idx >= 0) { noun[childKey].splice(idx, 1); removed = true }
        }
      }
    })
  } else if (spec!.nested && spec!.location.startsWith('domain.*')) {
    const field = spec!.location.split('.').pop()! // resources | persons | roles | groups
    walkDomains(doc.domain, (node) => {
      const idx = (node[field] ?? []).findIndex((i: any) => i.name === name)
      if (idx >= 0) { node[field].splice(idx, 1); removed = true }
    })
  } else {
    const arr = doc[spec!.location]
    if (Array.isArray(arr)) {
      const idx = arr.findIndex((i: any) => i.name === name)
      if (idx >= 0) {
        arr.splice(idx, 1)
        removed = true
      }
    }
  }

  if (!removed) {
    emitError(`${spec!.type} "${name}" not found in ${layer} of ${domain}`, opts)
    process.exit(1)
  }

  saveLayer(paths, layer, doc)
  emitOk({ layer, type: spec!.type, name, file: paths.files[layer] }, opts,
    () => `✓ Removed ${spec!.type} "${name}" from ${layer} (${domain})`)
}

function cmdValidateLayer(layer: Layer, domain: string, opts: { json: boolean }): void {
  const paths = resolveDomain(domain)
  const doc = loadLayer(paths, layer)
  const schemaId = layerSchemaId(layer)
  const validator = new DnaValidator()
  const result = validator.validate(doc, schemaId)

  if (result.valid) {
    emitOk({ layer, domain, valid: true }, opts, () => `✓ Valid ${layer}`)
    return
  }

  const errs = result.errors.map((e) => ({
    path: e.instancePath || '/',
    message: e.message,
    schemaPath: e.schemaPath,
  }))
  if (opts.json) {
    console.log(JSON.stringify({ ok: false, layer, domain, valid: false, errors: errs }, null, 2))
  } else {
    console.error(`✗ Invalid ${layer}`)
    for (const e of errs) console.error(`  ${e.path} ${e.message}`)
  }
  process.exit(1)
}

function layerSchemaId(layer: Layer): string {
  switch (layer) {
    case 'operational':
      return 'operational'
    case 'product.core':
      return 'product/core'
    case 'product.api':
      return 'product/api'
    case 'product.ui':
      return 'product/ui'
    case 'technical':
      return 'technical'
  }
}

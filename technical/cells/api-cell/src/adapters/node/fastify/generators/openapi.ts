/**
 * Generates `src/interpreter/openapi.ts` in the emitted fastify cell.
 *
 * Delegates the DNA → OpenAPI 3.1 render to `@dna-codes/output-openapi` —
 * the canonical contract layer. Adding a Field type in DNA + extending
 * output-openapi propagates here automatically on next regen, with no
 * cba-side change. (See `flip-api-cell-to-output-openapi` for the rationale
 * and parity audit.)
 *
 * Post-processing covers the gap between what output-openapi emits today
 * and what the cba runtime expects on the spec:
 *
 *   - `securitySchemes.bearerAuth` + per-operation `security: [{ bearerAuth: [] }]`
 *     — cba's runtime hard-wires bearer auth. output-openapi v0.1 has no
 *     auth shape. 📝 sister proposal in `dna/` should extend output-openapi
 *     to derive this from a future Auth DNA shape; until then we shim.
 *   - `401/403/404` stub responses — descriptive only ("Unauthorized", etc.);
 *     cosmetic enough to keep local instead of noising the renderer.
 *   - `tags: ["${Resource}s"]` per operation — preserves the per-resource
 *     sidebar grouping the hand-rolled spec produced. output-openapi tags
 *     by namespace name today; extending it to derive resource tags is 📝
 *     candidate. Until then we override per-op.
 *   - `x-roles` from `core.rules` access entries — cba-internal extension;
 *     not appropriate upstream.
 *
 * Express adapter still uses the hand-rolled builder
 * (`src/adapters/node/express/generators/openapi.ts`); flipping it is a
 * separate proposal so any divergence in render shape is caught explicitly,
 * not bundled.
 */
export function generateOpenApi(): string {
  return `import { render } from '@dna-codes/output-openapi'

/**
 * Build the runtime OpenAPI 3.1 doc served at /api-json. Delegates the
 * DNA → OpenAPI render to @dna-codes/output-openapi, then post-processes
 * for cba-runtime parity (bearer auth shape, default error responses,
 * resource tags, x-roles). See the cba adapter source for the full
 * rationale and the parity checklist.
 */
export function buildOpenApiSpec(api: any, core: any): any {
  const { content } = render(api, { format: 'json' })
  const doc = JSON.parse(content)

  // ── securitySchemes ────────────────────────────────────────────────────
  doc.components = doc.components ?? {}
  doc.components.securitySchemes = {
    ...(doc.components.securitySchemes ?? {}),
    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  }

  // Index endpoints by operationId so per-op post-processing doesn't
  // re-walk the full DNA each time. operationId in output-openapi is
  // \`\${resource}\${Action}\` (camelCase from \`Resource.Action\`).
  const byOperationId: Record<string, any> = {}
  for (const ep of api.endpoints ?? []) {
    const [r, a] = String(ep.operation ?? '').split('.')
    if (!r || !a) continue
    const opId = \`\${r[0].toLowerCase()}\${r.slice(1)}\${a[0].toUpperCase()}\${a.slice(1)}\`
    byOperationId[opId] = ep
  }

  for (const methods of Object.values(doc.paths ?? {}) as any[]) {
    for (const op of Object.values(methods) as any[]) {
      const ep = byOperationId[op.operationId]
      if (!ep) continue

      // ── per-operation security ─────────────────────────────────────────
      op.security = op.security ?? [{ bearerAuth: [] }]

      // ── tags: resource-name pluralized (preserves Redoc sidebar grouping) ─
      const [resource] = String(ep.operation).split('.')
      if (resource) op.tags = [\`\${resource}s\`]

      // ── default error responses ────────────────────────────────────────
      op.responses = op.responses ?? {}
      op.responses['401'] = op.responses['401'] ?? { description: 'Unauthorized' }
      op.responses['403'] = op.responses['403'] ?? { description: 'Forbidden' }
      op.responses['404'] = op.responses['404'] ?? { description: 'Not found' }

      // ── x-roles from access rules ──────────────────────────────────────
      const rule = (core?.rules ?? []).find(
        (r: any) => r.operation === ep.operation && r.type === 'access',
      )
      const roles: string[] = rule?.allow?.map((a: any) => a.role).filter(Boolean) ?? []
      if (roles.length) op['x-roles'] = roles
    }
  }

  return doc
}
`
}

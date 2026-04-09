/**
 * Generates Express signal receiver endpoints. For each Cause with
 * source: "signal" in Operational DNA, creates a POST /_signals/:signalName
 * route that accepts the typed Signal payload, validates it, and dispatches
 * to the corresponding Capability handler.
 *
 * Pattern A (HTTP push): publisher API → HTTP POST → subscriber API's
 * /_signals/:signalName endpoint. Pattern B (queue + worker) will reuse
 * the same handler contract with a different transport.
 */
export function generateSignalReceiver(): string {
  return `import { Router, Request, Response } from 'express'
import { getDataStore } from './store'

function resolveEffectSet(
  set: unknown,
  entity: Record<string, any>,
  body: Record<string, any>,
): unknown {
  if (typeof set === 'number' || typeof set === 'boolean') return set
  if (typeof set !== 'string') return undefined
  if (set === 'now') return new Date()
  if (set === 'actor.id') return 'system'
  const addMatch = set.match(/^(\\w+)\\.(\\w+)\\s*\\+\\s*input\\.(\\w+)$/)
  if (addMatch) {
    const [, , entityField, inputField] = addMatch
    return (entity[entityField] ?? 0) + body[inputField]
  }
  if (/^[\\w_-]+$/.test(set)) return set
  return undefined
}

function applyEffects(
  entity: Record<string, any>,
  capability: string,
  operational: any,
  body: Record<string, any>,
) {
  const outcome = operational.outcomes?.find((o: any) => o.capability === capability)
  if (!outcome) return
  for (const change of outcome.changes) {
    const attr = change.attribute.split('.').pop()
    const val = resolveEffectSet(change.set, entity, body)
    if (val !== undefined) entity[attr] = val
  }
}

/**
 * Builds a router that exposes POST endpoints for each Signal this API
 * subscribes to (via Cause with source: "signal"). Each endpoint:
 *
 * 1. Validates the incoming Signal payload against the Signal definition
 * 2. Resolves the target Capability from the Cause
 * 3. Executes the Capability's Outcome effects on the relevant entity
 * 4. Returns acknowledgement
 */
export function buildSignalReceiver(api: any, operational: any): Router {
  const router = Router()
  const causes = (operational.causes ?? []).filter((c: any) => c.source === 'signal' && c.signal)
  const signals = operational.signals ?? []

  for (const cause of causes) {
    const signalDef = signals.find((s: any) => s.name === cause.signal)

    router.post(\`/\${cause.signal}\`, async (req: Request, res: Response) => {
      try {
        const { payload, signal, timestamp } = req.body

        if (!payload) {
          return res.status(400).json({ error: 'Missing payload in request body' })
        }

        console.log(\`[signal-receiver] \${signal} → \${cause.capability}\`, payload)

        // Validate payload fields match signal definition
        if (signalDef) {
          const requiredFields = signalDef.payload
            .filter((f: any) => f.required !== false)
            .map((f: any) => f.name)
          const missing = requiredFields.filter((f: string) => payload[f] === undefined)
          if (missing.length) {
            return res.status(400).json({
              error: \`Missing required payload fields: \${missing.join(', ')}\`,
              signal: cause.signal,
            })
          }
        }

        // Resolve the target resource and execute Capability effects
        const [nounName] = cause.capability.split('.')
        const resourceKey = nounName.toLowerCase() + 's'
        const store = getDataStore()

        // If payload contains an entity ID, apply effects to that entity
        const idField = nounName.toLowerCase() + '_id'
        const entityId = payload[idField] ?? payload.id
        if (entityId) {
          const entity = await store.findById(resourceKey, entityId)
          if (entity) {
            applyEffects(entity, cause.capability, operational, payload)
            entity.updated_at = new Date()
            await store.update(resourceKey, entityId, entity)
            console.log(\`[signal-receiver] Applied \${cause.capability} effects to \${nounName} \${entityId}\`)
          } else {
            // Entity not found — may need to create it (e.g. PaymentSchedule.Create)
            const now = new Date()
            const newEntity: Record<string, any> = {
              id: crypto.randomUUID(),
              ...payload,
              created_at: now,
              updated_at: now,
            }
            applyEffects(newEntity, cause.capability, operational, payload)
            await store.create(resourceKey, newEntity)
            console.log(\`[signal-receiver] Created \${nounName} from \${cause.capability}\`)
          }
        }

        res.json({
          received: true,
          signal: cause.signal,
          capability: cause.capability,
          timestamp: new Date().toISOString(),
        })
      } catch (err: any) {
        console.error(\`[signal-receiver] Error handling \${cause.signal}:\`, err.message)
        res.status(500).json({ error: err.message })
      }
    })
  }

  if (causes.length) {
    console.log(\`[signal-receiver] Registered \${causes.length} signal endpoint(s):\`)
    for (const cause of causes) {
      console.log(\`  POST /_signals/\${cause.signal} → \${cause.capability}\`)
    }
  }

  return router
}
`
}

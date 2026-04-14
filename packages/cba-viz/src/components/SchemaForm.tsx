import { useEffect, useState, useMemo } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import type { RJSFSchema, UiSchema } from '@rjsf/utils'
import { FlagChipsWidget } from './widgets/FlagChipsWidget'

interface SchemaFormProps {
  /** Schema family under `/api/schemas/`. For operational primitives this is `operational`. */
  family: string
  /** Schema name within the family, without the `.json` extension (e.g. `capability`, `rule`). */
  schemaName: string
  /** Current data object — must conform to the schema. */
  data: unknown
  /** Called on every field edit with the full updated form data. */
  onChange: (next: unknown) => void
}

// ── Module-level schema cache ───────────────────────────────────────────
//
// RJSF's ajv validator is happy to re-use the same schema object across
// renders, and the schema files on disk don't change during a dev session.
// Cache them once per `family:name` key so that expanding 14 Capabilities
// in the sidebar doesn't trigger 14 network round-trips.
const schemaCache = new Map<string, RJSFSchema>()
const schemaInflight = new Map<string, Promise<RJSFSchema>>()

function fetchSchema(family: string, name: string): Promise<RJSFSchema> {
  const key = `${family}:${name}`
  const cached = schemaCache.get(key)
  if (cached) return Promise.resolve(cached)
  const inflight = schemaInflight.get(key)
  if (inflight) return inflight
  // `name` can be nested (e.g. `api/endpoint`). Encode each path segment
  // individually so the slashes stay intact for the middleware's
  // multi-segment regex while any other special chars still get escaped.
  const encodedName = name.split('/').map(encodeURIComponent).join('/')
  const p = fetch(`/api/schemas/${encodeURIComponent(family)}/${encodedName}`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch schema ${family}/${name}: ${res.status}`)
      }
      return res.json() as Promise<RJSFSchema>
    })
    .then((schema) => {
      schemaCache.set(key, schema)
      schemaInflight.delete(key)
      return schema
    })
    .catch((err) => {
      schemaInflight.delete(key)
      throw err
    })
  schemaInflight.set(key, p)
  return p
}

// ── UiSchema — dark theme + compact layout ──────────────────────────────
//
// RJSF's default widgets inherit from the host page's CSS, so we inject
// the dark-theme styling via the `ui:classNames` prop. Keeping it minimal
// for now — Phase 1 just needs forms that are *legible* over the dark
// canvas, not pixel-perfect design. Phase 5c.4 can revisit with custom
// widgets if the defaults feel cramped.
const BASE_UI_SCHEMA: UiSchema = {
  'ui:submitButtonOptions': {
    norender: true, // no explicit submit — onChange streams edits live
  },
}

// ── Schema-specific uiSchema overrides ──────────────────────────────────
//
// For Phase 5c.4 we only override the Rule form — the `flags` array on
// each `allow[]` entry renders as tag chips (FlagChipsWidget) instead of
// the default vertical list of text inputs. Other arrays on the Rule
// form (`conditions`, `allow` itself) keep their default rendering.
//
// Note the nesting: `allow.items.flags` — for an array field, RJSF
// uiSchema walks into `items` to reach the per-item object's properties.
// The `ui:widget` lives on the `flags` array field itself (not under its
// own `items`) because RJSF hands array-of-primitive widgets the whole
// array via `props.value` when overridden at the array level.
const RULE_UI_SCHEMA: UiSchema = {
  ...BASE_UI_SCHEMA,
  allow: {
    items: {
      flags: {
        'ui:widget': FlagChipsWidget,
      },
    },
  },
}

function uiSchemaFor(schemaName: string): UiSchema {
  if (schemaName === 'rule') return RULE_UI_SCHEMA
  return BASE_UI_SCHEMA
}

/**
 * Schema-driven form component.
 *
 * Fetches the JSON Schema from the middleware on mount, renders an RJSF
 * form bound to `data`, and streams every edit back to the parent via
 * `onChange`. No explicit submit button — changes propagate live so the
 * canvas and the "dirty" indicator update as the user types.
 *
 * Loading and error states are rendered inline so the Sidebar doesn't
 * have to special-case them.
 */
export function SchemaForm({ family, schemaName, data, onChange }: SchemaFormProps) {
  const [schema, setSchema] = useState<RJSFSchema | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSchema(null)
    setError(null)
    fetchSchema(family, schemaName)
      .then((s) => { if (active) setSchema(s) })
      .catch((err) => { if (active) setError(String(err.message ?? err)) })
    return () => { active = false }
  }, [family, schemaName])

  const uiSchema = useMemo(() => uiSchemaFor(schemaName), [schemaName])

  if (error) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: '#fca5a5' }}>
        Failed to load schema: {error}
      </div>
    )
  }

  if (!schema) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: '#64748b' }}>
        Loading schema…
      </div>
    )
  }

  return (
    <div className="cba-viz-schema-form" style={formContainerStyle}>
      <Form
        schema={schema}
        uiSchema={uiSchema}
        validator={validator}
        formData={data}
        liveValidate
        showErrorList={false}
        onChange={(e) => onChange(e.formData)}
      />
    </div>
  )
}

/**
 * Container styling. RJSF fields inherit these via the wrapper class —
 * we keep the scoping tight so the form doesn't bleed styles into the
 * rest of the sidebar (which has its own hand-rolled Field/Section UI
 * for Technical DNA).
 */
const formContainerStyle: React.CSSProperties = {
  padding: '8px 4px',
  fontSize: 12,
  color: '#e2e8f0',
}

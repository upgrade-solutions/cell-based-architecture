import { useState } from 'react'
import { dia } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import { SchemaForm } from './SchemaForm.tsx'

interface SidebarProps {
  model: GraphModel
  env: string
  adapter: string
}

export const Sidebar = observer(function Sidebar({ model, env, adapter }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const cellView = model.selectedCellView
  const cell = cellView?.model
  const dna = cell?.get('dna') as Record<string, unknown> | undefined

  if (collapsed) {
    return (
      <div style={collapsedContainerStyle}>
        <button
          onClick={() => setCollapsed(false)}
          style={collapseButtonStyle}
          title="Expand inspector"
          aria-label="Expand inspector"
        >
          ‹
        </button>
        <div style={collapsedLabelStyle}>INSPECTOR</div>
      </div>
    )
  }

  if (!dna) {
    return (
      <div style={containerStyle}>
        <SidebarHeader onCollapse={() => setCollapsed(true)} />
        <AdapterSection env={env} adapter={adapter} />
        <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
          Click a node or connection to inspect it.
        </div>
        <StatusLegend />
      </div>
    )
  }

  const element = cell?.isElement() ? cell as dia.Element : null
  const pos = element ? { x: element.position().x, y: element.position().y } : null
  const size = element ? { width: element.size().width, height: element.size().height } : null

  // DNA-driven nodes route through RJSF. The mapper stamps every
  // DNA element with `dna.layer` (operational | product-api | ...)
  // and a `dna.kind` discriminator. We map `(layer, kind)` to the
  // `(family, name)` of a JSON Schema file and render an RJSF form
  // bound to `dna.source`.
  //
  // The JointJS discriminator for annotation edges is `edge`; those
  // don't have a primitive schema and fall through to the read-only
  // inspector below.
  const layerName = dna.layer as string | undefined
  const kind = dna.kind as string | undefined
  const isSchemaBacked = layerName !== undefined && layerName !== 'technical'

  const schemaInfo = isSchemaBacked && kind ? lookupSchema(layerName, kind) : null

  return (
    <div style={containerStyle}>
      <SidebarHeader onCollapse={() => setCollapsed(true)} />
      <AdapterSection env={env} adapter={adapter} />
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Identity — shown for every node as a quick-glance summary */}
        <Section title="Identity">
          <Field label="ID" value={dna.id as string} />
          <Field label="Name" value={(dna.name as string) ?? ''} editable={!isSchemaBacked} onChange={(val) => {
            cell?.set('dna', { ...dna, name: val })
            cell?.attr({ label: { text: val } })
            model.setDirty(true)
          }} />
          {!isSchemaBacked && dna.type ? <Field label="Type" value={dna.type as string} /> : null}
          {kind ? <Field label="Kind" value={kind} /> : null}
          {layerName ? <Field label="Layer" value={layerName} /> : null}
          {dna.status ? <Field label="Status" value={dna.status as string} /> : null}
          {!isSchemaBacked && typeof dna.source === 'string' ? <Field label="Source" value={dna.source as string} /> : null}
        </Section>

        {/* DNA primitives: schema-driven RJSF form. Edits stream onto
            `dna.source` (the primitive payload) and mark the graph dirty
            so Ctrl+S saves the whole document. */}
        {schemaInfo ? (
          <Section title={`${kind} editor`}>
            <SchemaForm
              family={schemaInfo.family}
              schemaName={schemaInfo.name}
              data={dna.source}
              onChange={(next) => {
                // Merge the edited primitive back onto the cell's dna attr.
                // We keep `layer`, `kind`, and `id` so later re-selection
                // still routes through the same branch.
                cell?.set('dna', { ...dna, source: next })
                // Mirror a name change onto the canvas label when possible.
                // Kind-specific label rules keep the canvas in sync with
                // whatever the user typed in the form — capabilities go
                // by Noun.Verb, endpoints by METHOD path, everything else
                // by its `name` field.
                const nextObj = next as { name?: string; target?: string; action?: string; method?: string; path?: string }
                if (kind === 'operation' && nextObj.target && nextObj.action) {
                  cell?.attr({ label: { text: nextObj.name ?? `${nextObj.target}.${nextObj.action}` } })
                } else if (kind === 'endpoint' && nextObj.method && nextObj.path) {
                  cell?.attr({
                    methodLabel: { text: nextObj.method },
                    pathLabel: { text: nextObj.path },
                  })
                } else if (nextObj.name) {
                  cell?.attr({ label: { text: nextObj.name } })
                }
                model.setDirty(true)
              }}
            />
          </Section>
        ) : null}

        {/* Position */}
        {pos && size ? (
          <Section title="Position & Size">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="X" value={String(Math.round(pos.x))} />
              <Field label="Y" value={String(Math.round(pos.y))} />
              <Field label="W" value={String(Math.round(size.width))} />
              <Field label="H" value={String(Math.round(size.height))} />
            </div>
          </Section>
        ) : null}

        {/* Description */}
        {dna.description ? (
          <Section title="Description">
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              {dna.description as string}
            </p>
          </Section>
        ) : null}

        {/* Metadata */}
        {dna.metadata && Object.keys(dna.metadata as object).length > 0 ? (
          <Section title="Metadata">
            {Object.entries(dna.metadata as Record<string, unknown>).map(([key, val]) => (
              <Field key={key} label={key} value={String(val ?? '')} />
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  )
})

/**
 * Always-visible section showing the current env and the delivery adapter
 * it maps to. The Env selector in the toolbar is the single control — this
 * is a read-only display surfacing the derived adapter so users don't need
 * to guess which backend their status polls are hitting.
 */
function AdapterSection({ env, adapter }: { env: string; adapter: string }) {
  const adapterLabel = adapter === 'terraform/aws' ? 'Terraform / AWS' : 'Docker Compose'
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#64748b',
        marginBottom: 8,
      }}>
        Adapter
      </div>
      <Field label="Env" value={env} />
      <Field label="Via" value={adapterLabel} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#64748b',
        marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  editable,
  onChange,
}: {
  label: string
  value: string
  editable?: boolean
  onChange?: (val: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#64748b', minWidth: 50 }}>{label}</span>
      {editable && onChange ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            background: '#334155',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: 3,
            padding: '2px 6px',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span style={{
          flex: 1,
          fontSize: 12,
          color: '#f8fafc',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
      )}
    </div>
  )
}

const STATUS_LEGEND = [
  { status: 'Deployed', color: '#3b82f6', dash: false, note: 'full color, solid' },
  { status: 'Planned', color: '#64748b', dash: false, note: 'greyed out, solid' },
  { status: 'Proposed', color: '#475569', dash: true, note: 'dashed, dim' },
]

function StatusLegend() {
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#64748b',
        marginBottom: 10,
      }}>
        Status Legend
      </div>
      {STATUS_LEGEND.map(({ status, color, dash, note }) => (
        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 24,
            height: 14,
            borderRadius: 3,
            border: `2px ${dash ? 'dashed' : 'solid'} ${color}`,
            background: '#1e293b',
            opacity: status === 'Proposed' ? 0.45 : status === 'Planned' ? 0.6 : 1,
          }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{status}</span>
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>{note}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Map `(layer, kind)` to the schema `(family, name)` the RJSF form
 * should fetch. Schema files live under `operational/schemas/`,
 * `product/schemas/{core,api,web}/`, and `technical/schemas/`. The
 * `name` can be nested (e.g. `api/endpoint`) — SchemaForm preserves
 * slashes in the fetch URL so the middleware can resolve the right
 * file.
 *
 * Returns `null` for unknown combinations. Edges and shapes we don't
 * have a schema for fall through to the read-only Identity panel.
 */
function lookupSchema(layer: string, kind: string): { family: string; name: string } | null {
  // Operational primitives live at the root of operational/schemas/
  if (layer === 'operational') {
    switch (kind) {
      case 'domain':     return { family: 'operational', name: 'domain' }
      case 'resource':   return { family: 'operational', name: 'resource' }
      case 'person':     return { family: 'operational', name: 'person' }
      case 'role':       return { family: 'operational', name: 'role' }
      case 'group':      return { family: 'operational', name: 'group' }
      case 'operation':  return { family: 'operational', name: 'operation' }
      case 'trigger':    return { family: 'operational', name: 'trigger' }
      case 'rule':       return { family: 'operational', name: 'rule' }
      case 'task':       return { family: 'operational', name: 'task' }
      case 'process':    return { family: 'operational', name: 'process' }
      case 'membership': return { family: 'operational', name: 'membership' }
    }
  }

  // Product API primitives live under product/schemas/api/ and
  // product/schemas/core/. Namespace + Endpoint are API-only; Resource
  // is shared across core/api/ui so it lives under core/.
  if (layer === 'product-api') {
    switch (kind) {
      case 'namespace': return { family: 'product', name: 'api/namespace' }
      case 'resource':  return { family: 'product', name: 'core/resource' }
      case 'endpoint':  return { family: 'product', name: 'api/endpoint' }
    }
  }

  // Product UI primitives live under product/schemas/web/. The
  // `layout` schema is open-ended (different layout variants carry
  // different config shapes), but RJSF just renders whatever fields
  // the schema declares.
  if (layer === 'product-ui') {
    switch (kind) {
      case 'layout': return { family: 'product', name: 'web/layout' }
      case 'page':   return { family: 'product', name: 'web/page' }
      case 'block':  return { family: 'product', name: 'web/block' }
    }
  }

  return null
}

/**
 * Sidebar header with a collapse button. The caret flips direction based on
 * state, so the same control both collapses (›) and expands (‹) the panel.
 */
function SidebarHeader({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div style={headerStyle}>
      <span>Inspector</span>
      <button
        onClick={onCollapse}
        style={collapseButtonStyle}
        title="Collapse inspector"
        aria-label="Collapse inspector"
      >
        ›
      </button>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  width: 280,
  height: '100%',
  background: '#1e293b',
  borderLeft: '1px solid #334155',
  overflow: 'auto',
  transition: 'width 200ms ease',
}

const collapsedContainerStyle: React.CSSProperties = {
  width: 32,
  height: '100%',
  background: '#1e293b',
  borderLeft: '1px solid #334155',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
  gap: 12,
  transition: 'width 200ms ease',
}

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 700,
  color: '#f8fafc',
  borderBottom: '1px solid #334155',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const collapseButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  color: '#94a3b8',
  borderRadius: 3,
  width: 22,
  height: 22,
  lineHeight: '18px',
  padding: 0,
  fontSize: 16,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const collapsedLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.1em',
  writingMode: 'vertical-rl',
  transform: 'rotate(180deg)',
  marginTop: 8,
  userSelect: 'none',
}

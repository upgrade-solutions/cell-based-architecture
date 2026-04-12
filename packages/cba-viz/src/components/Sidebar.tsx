import { dia } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'

interface SidebarProps {
  model: GraphModel
}

export const Sidebar = observer(function Sidebar({ model }: SidebarProps) {
  const cellView = model.selectedCellView
  const cell = cellView?.model
  const dna = cell?.get('dna') as Record<string, unknown> | undefined

  if (!dna) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Inspector</div>
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

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Inspector</div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Identity */}
        <Section title="Identity">
          <Field label="ID" value={dna.id as string} />
          <Field label="Name" value={dna.name as string} editable onChange={(val) => {
            cell?.set('dna', { ...dna, name: val })
            cell?.attr({ label: { text: val } })
            model.setDirty(true)
          }} />
          <Field label="Type" value={dna.type as string} />
          {dna.status ? <Field label="Status" value={dna.status as string} /> : null}
          {dna.source ? <Field label="Source" value={dna.source as string} /> : null}
        </Section>

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

const containerStyle: React.CSSProperties = {
  width: 280,
  height: '100%',
  background: '#1e293b',
  borderLeft: '1px solid #334155',
  overflow: 'auto',
}

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 700,
  color: '#f8fafc',
  borderBottom: '1px solid #334155',
}

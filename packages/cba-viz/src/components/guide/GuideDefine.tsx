import { useState, useCallback } from 'react'
import type { OperationalDNA, Domain, NounLike } from '../../loaders/operational-loader.ts'
import { PRIMITIVE_COLORS } from './types.ts'

interface GuideDefineProps {
  dna: OperationalDNA
  onChange: (dna: OperationalDNA) => void
}

interface SectionConfig {
  label: string
  color: string
  items: { name: string; detail?: string }[]
}

function walkNouns(domain: Domain, fn: (n: NounLike, kind: 'resource' | 'person' | 'role' | 'group') => void): void {
  for (const r of domain.resources ?? []) fn(r, 'resource')
  for (const p of domain.persons ?? []) fn(p, 'person')
  for (const r of domain.roles ?? []) fn(r, 'role')
  for (const g of domain.groups ?? []) fn(g, 'group')
  for (const sub of domain.domains ?? []) walkNouns(sub, fn)
}

function collectSections(dna: OperationalDNA): SectionConfig[] {
  const resources: { name: string; detail?: string }[] = []
  const persons: { name: string; detail?: string }[] = []
  const roles: { name: string; detail?: string }[] = []
  const groups: { name: string; detail?: string }[] = []

  walkNouns(dna.domain, (noun, kind) => {
    const attrCount = (noun.attributes ?? []).length
    const actionCount = (noun.actions ?? []).length
    const detail = `${attrCount} attrs, ${actionCount} actions`
    const entry = { name: noun.name, detail }
    switch (kind) {
      case 'resource': resources.push(entry); break
      case 'person':   persons.push(entry); break
      case 'role':     roles.push(entry); break
      case 'group':    groups.push(entry); break
    }
  })

  return [
    { label: 'Resources', color: PRIMITIVE_COLORS.resource, items: resources },
    { label: 'Persons', color: PRIMITIVE_COLORS.person, items: persons },
    { label: 'Roles', color: PRIMITIVE_COLORS.role, items: roles },
    { label: 'Groups', color: PRIMITIVE_COLORS.group, items: groups },
    {
      label: 'Operations',
      color: PRIMITIVE_COLORS.operation,
      items: (dna.operations ?? []).map((o) => ({ name: o.name, detail: o.description })),
    },
    {
      label: 'Triggers',
      color: PRIMITIVE_COLORS.trigger,
      items: (dna.triggers ?? []).map((t) => ({
        name: t.operation ?? t.process ?? `(${t.source})`,
        detail: `source: ${t.source}`,
      })),
    },
    {
      label: 'Rules',
      color: PRIMITIVE_COLORS.rule,
      items: (dna.rules ?? []).map((r) => ({
        name: r.name ?? `${r.operation} (${r.type ?? 'access'})`,
        detail: r.description,
      })),
    },
    {
      label: 'Tasks',
      color: PRIMITIVE_COLORS.task,
      items: (dna.tasks ?? []).map((t) => ({ name: t.name, detail: `${t.actor} does ${t.operation}` })),
    },
    {
      label: 'Processes',
      color: PRIMITIVE_COLORS.process,
      items: (dna.processes ?? []).map((p) => ({
        name: p.name,
        detail: `${p.steps.length} steps, operator: ${p.operator}`,
      })),
    },
    {
      label: 'Memberships',
      color: PRIMITIVE_COLORS.membership,
      items: (dna.memberships ?? []).map((m) => ({
        name: m.name,
        detail: `${m.person} → ${m.role}${m.group ? ` (in ${m.group})` : ''}`,
      })),
    },
    {
      label: 'Relationships',
      color: PRIMITIVE_COLORS.relationship,
      items: (dna.relationships ?? []).map((r) => ({
        name: r.name,
        detail: `${r.from} → ${r.to} (${r.cardinality})`,
      })),
    },
  ]
}

export function GuideDefine({ dna, onChange }: GuideDefineProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const sections = collectSections(dna)
  void onChange

  const toggle = useCallback((label: string) => {
    setExpanded((prev) => (prev === label ? null : label))
  }, [])

  const totalPrimitives = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div style={containerStyle}>
      <div style={leftStyle}>
        <div style={sectionHeaderStyle}>
          Primitives
          <span style={totalStyle}>{totalPrimitives} total</span>
        </div>
        <div style={accordionStyle}>
          {sections.map((section) => (
            <div key={section.label}>
              <button
                onClick={() => toggle(section.label)}
                style={{ ...accordionHeaderStyle, borderLeftColor: section.color }}
              >
                <span style={accordionLabelStyle}>{section.label}</span>
                <span style={{ ...accordionCountStyle, color: section.color }}>{section.items.length}</span>
                <span style={chevronStyle}>{expanded === section.label ? '▼' : '▶'}</span>
              </button>
              {expanded === section.label && (
                <div style={accordionBodyStyle}>
                  {section.items.length === 0 ? (
                    <div style={emptyItemStyle}>No {section.label.toLowerCase()} defined.</div>
                  ) : (
                    section.items.map((item, i) => (
                      <div key={i} style={itemStyle}>
                        <span style={itemNameStyle}>{item.name}</span>
                        {item.detail && <span style={itemDetailStyle}>{item.detail}</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={rightStyle}>
        <div style={sectionHeaderStyle}>DNA Preview</div>
        <div style={previewStyle}>
          <div style={domainBoxStyle}>
            <span style={domainLabelStyle}>Domain</span>
            <span style={domainNameStyle}>{dna.domain.path ?? dna.domain.name}</span>
            {dna.domain.description && <span style={domainDescStyle}>{dna.domain.description}</span>}
          </div>

          <div style={previewGridStyle}>
            {sections.filter((s) => s.items.length > 0).map((section) => (
              <div key={section.label} style={previewCardStyle}>
                <div style={{ ...previewCardHeaderStyle, borderBottomColor: section.color }}>
                  <span>{section.label}</span>
                  <span style={{ color: section.color, fontWeight: 700 }}>{section.items.length}</span>
                </div>
                <div style={previewCardBodyStyle}>
                  {section.items.slice(0, 8).map((item, i) => (
                    <div key={i} style={previewItemStyle}>{item.name}</div>
                  ))}
                  {section.items.length > 8 && (
                    <div style={previewMoreStyle}>+{section.items.length - 8} more</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = { display: 'flex', gap: 24, height: '100%', minHeight: 0 }
const leftStyle: React.CSSProperties = { flex: '0 0 360px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }
const rightStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, overflow: 'auto' }

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8,
  fontFamily: '-apple-system, sans-serif',
}
const totalStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: '#64748b', textTransform: 'none', letterSpacing: 0 }

const accordionStyle: React.CSSProperties = { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }

const accordionHeaderStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', background: '#1e293b', border: 'none',
  borderLeft: '3px solid', borderRadius: 4, cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
}
const accordionLabelStyle: React.CSSProperties = { flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#e2e8f0' }
const accordionCountStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }
const chevronStyle: React.CSSProperties = { fontSize: 9, color: '#475569' }

const accordionBodyStyle: React.CSSProperties = {
  padding: '4px 0 4px 16px', display: 'flex', flexDirection: 'column', gap: 2,
}
const emptyItemStyle: React.CSSProperties = { fontSize: 11, color: '#475569', padding: '4px 0', fontFamily: '-apple-system, sans-serif' }
const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 8px',
  background: '#0f172a', borderRadius: 3,
}
const itemNameStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#cbd5e1', fontFamily: 'ui-monospace, monospace' }
const itemDetailStyle: React.CSSProperties = { fontSize: 10, color: '#64748b', fontFamily: '-apple-system, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const previewStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }

const domainBoxStyle: React.CSSProperties = {
  padding: '12px 16px', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4,
}
const domainLabelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: '-apple-system, sans-serif' }
const domainNameStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#f1f5f9', fontFamily: 'ui-monospace, monospace' }
const domainDescStyle: React.CSSProperties = { fontSize: 12, color: '#94a3b8', fontFamily: '-apple-system, sans-serif' }

const previewGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }

const previewCardStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 6, overflow: 'hidden',
}
const previewCardHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', padding: '6px 10px',
  fontSize: 11, fontWeight: 600, color: '#e2e8f0', borderBottom: '2px solid',
  fontFamily: '-apple-system, sans-serif',
}
const previewCardBodyStyle: React.CSSProperties = { padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }
const previewItemStyle: React.CSSProperties = { fontSize: 10, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const previewMoreStyle: React.CSSProperties = { fontSize: 10, color: '#475569', fontStyle: 'italic', fontFamily: '-apple-system, sans-serif' }

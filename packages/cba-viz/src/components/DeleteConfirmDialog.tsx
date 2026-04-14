import type { RemovedPrimitive } from '../features/operational-mutations.ts'

/**
 * Phase 5c.4 Chunk 1 — confirmation dialog for operational deletes.
 *
 * The caller has already computed the cascade via `previewCascade`;
 * this component just lists what will be removed and asks for a final
 * yes/no. Keeping the preview computation outside the dialog means
 * the actual delete uses exactly the same list the user saw (no
 * chance for drift between preview and commit).
 */

interface DeleteConfirmDialogProps {
  primaryLabel: string
  removed: RemovedPrimitive[]
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({ primaryLabel, removed, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const cascaded = removed.slice(1)

  return (
    <div style={backdropStyle} onClick={onCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>Confirm Delete</span>
          <button onClick={onCancel} style={closeButtonStyle} aria-label="Close">×</button>
        </div>
        <div style={bodyStyle}>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            Delete <strong style={{ color: '#fca5a5' }}>{primaryLabel}</strong>?
          </div>
          {cascaded.length > 0 ? (
            <div style={cascadeBoxStyle}>
              <div style={cascadeHeaderStyle}>
                The following {cascaded.length} related {cascaded.length === 1 ? 'primitive' : 'primitives'} will also be removed:
              </div>
              <ul style={listStyle}>
                {cascaded.map((r, i) => (
                  <li key={`${r.kind}:${r.name}:${i}`} style={listItemStyle}>
                    <span style={kindBadgeStyle(r.kind)}>{r.kind}</span>
                    <span style={{ color: '#cbd5e1' }}>{r.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              No related primitives will be affected.
            </div>
          )}
          <div style={warnStyle}>
            This change is not persisted until you press Save (Ctrl+S).
          </div>
        </div>
        <div style={footerStyle}>
          <button onClick={onCancel} style={cancelButtonStyle}>Cancel</button>
          <button onClick={onConfirm} style={deleteButtonStyle}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
}

const dialogStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #7f1d1d',
  borderRadius: 6,
  width: 420,
  maxWidth: '90vw',
  color: '#f8fafc',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 700,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  fontSize: 20,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
  width: 24,
  height: 24,
}

const bodyStyle: React.CSSProperties = {
  padding: 16,
}

const cascadeBoxStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 4,
  padding: 10,
  marginBottom: 12,
  maxHeight: 220,
  overflow: 'auto',
}

const cascadeHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 8,
  fontWeight: 600,
}

const listStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
}

function kindBadgeStyle(kind: string): React.CSSProperties {
  const palette: Record<string, { bg: string; fg: string }> = {
    noun:       { bg: '#1e3a5f', fg: '#93c5fd' },
    capability: { bg: '#14532d', fg: '#86efac' },
    rule:       { bg: '#78350f', fg: '#fcd34d' },
    outcome:    { bg: '#4c1d95', fg: '#c4b5fd' },
    signal:     { bg: '#881337', fg: '#fda4af' },
  }
  const color = palette[kind] ?? { bg: '#334155', fg: '#cbd5e1' }
  return {
    background: color.bg,
    color: color.fg,
    borderRadius: 3,
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: 64,
    textAlign: 'center',
  }
}

const warnStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  marginTop: 12,
  fontStyle: 'italic',
}

const footerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid #334155',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
}

const cancelButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '6px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const deleteButtonStyle: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: '1px solid #991b1b',
  borderRadius: 4,
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

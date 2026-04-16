import { useState, useCallback } from 'react'
import type { Extraction, PrimitiveType, DiscoverState } from './types.ts'
import { PRIMITIVE_COLORS } from './types.ts'
import type { OperationalDNA } from '../../loaders/operational-loader.ts'

interface GuideDiscoverProps {
  state: DiscoverState
  onChange: (state: DiscoverState) => void
  onProceed: () => void
  dna: OperationalDNA | null
}

export function GuideDiscover({ state, onChange, onProceed, dna }: GuideDiscoverProps) {
  const [showDna, setShowDna] = useState(false)

  const handleToggle = useCallback((id: string) => {
    onChange({
      ...state,
      extractions: state.extractions.map((e) =>
        e.id === id ? { ...e, approved: !e.approved } : e,
      ),
    })
  }, [state, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange({
      ...state,
      extractions: state.extractions.filter((e) => e.id !== id),
    })
  }, [state, onChange])

  const handleParentChange = useCallback((id: string, parentNoun: string) => {
    onChange({
      ...state,
      extractions: state.extractions.map((e) =>
        e.id === id ? { ...e, parentNoun } : e,
      ),
    })
  }, [state, onChange])

  const approvedCount = state.extractions.filter((e) => e.approved).length
  const nounExtractions = state.extractions
    .filter((e) => e.primitiveType === 'noun' && e.approved)
    .map((e) => e.text.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''))

  const grouped = new Map<PrimitiveType, Extraction[]>()
  for (const ext of state.extractions) {
    const list = grouped.get(ext.primitiveType) ?? []
    list.push(ext)
    grouped.set(ext.primitiveType, list)
  }

  return (
    <div style={containerStyle}>
      {/* Left: source text */}
      <div style={leftStyle}>
        <div style={sectionHeaderStyle}>Source Material</div>
        <textarea
          value={state.sourceText}
          onChange={(e) => onChange({ ...state, sourceText: e.target.value })}
          placeholder="Paste meeting notes, requirements documents, transcripts, or any source material here."
          style={textareaStyle}
        />
      </div>

      {/* Right: extractions */}
      <div style={rightStyle}>
        <div style={extractionHeaderStyle}>
          <div style={sectionHeaderStyle}>
            Extractions
            {approvedCount > 0 && <span style={countStyle}>{approvedCount} approved</span>}
          </div>
          <button onClick={() => setShowDna(true)} style={viewDnaButtonStyle} disabled={!dna}>
            View DNA
          </button>
        </div>

        {state.extractions.length === 0 ? (
          <div style={emptyStyle}>
            Paste source material on the left. Primitives will be auto-extracted here — you can toggle off any you don't want, or add manual tags by selecting text.
          </div>
        ) : (
          <div style={extractionListStyle}>
            {[...grouped.entries()].map(([type, items]) => (
              <div key={type}>
                <div style={{ ...groupHeaderStyle, color: PRIMITIVE_COLORS[type] }}>{type}</div>
                {items.map((ext) => (
                  <div key={ext.id} style={{ ...extractionStyle, opacity: ext.approved ? 1 : 0.5, borderColor: ext.approved ? PRIMITIVE_COLORS[ext.primitiveType] : '#334155' }}>
                    <div style={extTextStyle}>{ext.text}</div>
                    {(ext.primitiveType === 'attribute' || ext.primitiveType === 'verb' || ext.primitiveType === 'person') && (
                      <select
                        value={ext.parentNoun ?? ''}
                        onChange={(e) => handleParentChange(ext.id, e.target.value)}
                        style={parentSelectStyle}
                      >
                        <option value="">parent noun...</option>
                        {nounExtractions.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    )}
                    <div style={extActionsStyle}>
                      <button onClick={() => handleToggle(ext.id)} style={extToggleStyle}>
                        {ext.approved ? '✓' : '○'}
                      </button>
                      <button onClick={() => handleRemove(ext.id)} style={extRemoveStyle}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {approvedCount > 0 && (
          <button onClick={onProceed} style={proceedStyle}>
            Proceed to Design ({approvedCount} extractions)
          </button>
        )}
      </div>

      {showDna && dna && (
        <div style={modalBackdropStyle} onClick={() => setShowDna(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <span style={modalTitleStyle}>Operational DNA (raw JSON)</span>
              <button onClick={() => setShowDna(false)} style={modalCloseStyle}>×</button>
            </div>
            <pre style={modalPreStyle}>{JSON.stringify(dna, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  height: '100%',
  minHeight: 0,
}

const leftStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
}

const rightStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: '-apple-system, sans-serif',
}

const countStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#10b981',
  textTransform: 'none' as const,
  letterSpacing: 0,
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  padding: 16,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: '-apple-system, sans-serif',
  resize: 'none',
  outline: 'none',
}

const extractionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const viewDnaButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 500,
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#cbd5e1',
  cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
}

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const modalStyle: React.CSSProperties = {
  width: '80%',
  maxWidth: 960,
  height: '80%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 20px',
  borderBottom: '1px solid #334155',
  background: '#1e293b',
}

const modalTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: '-apple-system, sans-serif',
}

const modalCloseStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: 18,
}

const modalPreStyle: React.CSSProperties = {
  flex: 1,
  margin: 0,
  padding: 20,
  overflow: 'auto',
  fontSize: 11,
  lineHeight: 1.5,
  color: '#cbd5e1',
  background: '#0f172a',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  color: '#475569',
  fontSize: 13,
  textAlign: 'center',
  fontFamily: '-apple-system, sans-serif',
  lineHeight: 1.6,
}

const extractionListStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const groupHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 4,
  fontFamily: 'ui-monospace, monospace',
}

const extractionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  background: '#0f172a',
  border: '1px solid',
  borderRadius: 4,
  marginBottom: 4,
}

const extTextStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: '#cbd5e1',
  fontFamily: '-apple-system, sans-serif',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const parentSelectStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 10,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 3,
  color: '#94a3b8',
  fontFamily: 'ui-monospace, monospace',
}

const extActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  flexShrink: 0,
}

const extToggleStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: 3,
  color: '#10b981',
  cursor: 'pointer',
  fontSize: 14,
}

const extRemoveStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: 3,
  color: '#ef4444',
  cursor: 'pointer',
  fontSize: 14,
}

const proceedStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  background: '#10b981',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
}

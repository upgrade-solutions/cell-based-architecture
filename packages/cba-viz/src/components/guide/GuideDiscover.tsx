import { useRef, useCallback } from 'react'
import type { Extraction, PrimitiveType, DiscoverState } from './types.ts'
import { PRIMITIVE_TYPES, PRIMITIVE_COLORS } from './types.ts'

interface GuideDiscoverProps {
  state: DiscoverState
  onChange: (state: DiscoverState) => void
  onProceed: () => void
}

export function GuideDiscover({ state, onChange, onProceed }: GuideDiscoverProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleTag = useCallback((type: PrimitiveType) => {
    const ta = textareaRef.current
    if (!ta) return
    const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
    if (!selected) return

    const extraction: Extraction = {
      id: crypto.randomUUID(),
      text: selected,
      primitiveType: type,
      confidence: 'manual',
      approved: true,
    }
    onChange({ ...state, extractions: [...state.extractions, extraction] })
  }, [state, onChange])

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
          ref={textareaRef}
          value={state.sourceText}
          onChange={(e) => onChange({ ...state, sourceText: e.target.value })}
          placeholder="Paste meeting notes, requirements documents, transcripts, or any source material here."
          style={textareaStyle}
        />
        <div style={tagBarStyle}>
          <span style={tagLabelStyle}>Manual tag (optional) — select text then click a type:</span>
          <div style={tagButtonsStyle}>
            {PRIMITIVE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleTag(type)}
                style={{ ...tagButtonStyle, borderColor: PRIMITIVE_COLORS[type], color: PRIMITIVE_COLORS[type] }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: extractions */}
      <div style={rightStyle}>
        <div style={sectionHeaderStyle}>
          Extractions
          {approvedCount > 0 && <span style={countStyle}>{approvedCount} approved</span>}
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
                        {ext.approved ? '\u2713' : '\u25cb'}
                      </button>
                      <button onClick={() => handleRemove(ext.id)} style={extRemoveStyle}>\u00d7</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {approvedCount > 0 && (
          <button onClick={onProceed} style={proceedStyle}>
            Proceed to Define ({approvedCount} extractions)
          </button>
        )}
      </div>
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

const tagBarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const tagLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  fontFamily: '-apple-system, sans-serif',
}

const tagButtonsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
}

const tagButtonStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 500,
  background: 'transparent',
  border: '1px solid',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'ui-monospace, monospace',
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

import { useState } from 'react'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import {
  addNoun,
  addCapability,
  addRule,
  addOutcome,
  listNouns,
  listCapabilities,
} from '../features/operational-mutations.ts'

/**
 * Phase 5c.4 Chunk 1 — create dialog for operational primitives.
 *
 * Deliberately minimum-viable: a type picker, a small form per type,
 * and an "Add" button that calls the matching mutation helper. The
 * dialog doesn't know how to save — it hands the new DNA back to the
 * parent via onCreate, which re-sets operationalDna state.
 *
 * Supported kinds: Noun, Capability, Rule, Outcome. Signal + other
 * primitives are deferred to a later chunk.
 */

type PrimitiveType = 'noun' | 'capability' | 'rule' | 'outcome'

interface CreatePrimitiveDialogProps {
  dna: OperationalDNA
  onCreate: (nextDna: OperationalDNA) => void
  onClose: () => void
}

export function CreatePrimitiveDialog({ dna, onCreate, onClose }: CreatePrimitiveDialogProps) {
  const [kind, setKind] = useState<PrimitiveType>('noun')

  // Per-type form state — kept as a single flat bag so the submit
  // handler doesn't juggle refs. Only the fields for the active type
  // are read.
  const [nounName, setNounName] = useState('')
  const [capNoun, setCapNoun] = useState('')
  const [capVerb, setCapVerb] = useState('')
  const [ruleCapability, setRuleCapability] = useState('')
  const [ruleType, setRuleType] = useState<'access' | 'condition'>('access')
  const [outcomeCapability, setOutcomeCapability] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nouns = listNouns(dna)
  const capabilities = listCapabilities(dna)

  const handleSubmit = () => {
    setError(null)
    try {
      if (kind === 'noun') {
        if (!nounName.trim()) return setError('Name is required')
        if (nouns.some((n) => n.name === nounName.trim())) {
          return setError(`Noun "${nounName.trim()}" already exists`)
        }
        onCreate(addNoun(dna, { name: nounName.trim() }))
      } else if (kind === 'capability') {
        if (!capNoun) return setError('Pick a noun')
        if (!capVerb.trim()) return setError('Verb is required')
        const name = `${capNoun}.${capVerb.trim()}`
        if (capabilities.some((c) => (c.name ?? `${c.noun}.${c.verb}`) === name)) {
          return setError(`Capability "${name}" already exists`)
        }
        onCreate(addCapability(dna, { noun: capNoun, verb: capVerb.trim() }))
      } else if (kind === 'rule') {
        if (!ruleCapability) return setError('Pick a capability')
        onCreate(addRule(dna, { capability: ruleCapability, type: ruleType }))
      } else if (kind === 'outcome') {
        if (!outcomeCapability) return setError('Pick a capability')
        onCreate(addOutcome(dna, { capability: outcomeCapability }))
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>New Operational Primitive</span>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">×</button>
        </div>

        <div style={bodyStyle}>
          <label style={labelStyle}>Type</label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as PrimitiveType)
              setError(null)
            }}
            style={selectStyle}
          >
            <option value="noun">Noun</option>
            <option value="capability">Capability</option>
            <option value="rule">Rule</option>
            <option value="outcome">Outcome</option>
          </select>

          {kind === 'noun' ? (
            <>
              <label style={labelStyle}>Name</label>
              <input
                value={nounName}
                onChange={(e) => setNounName(e.target.value)}
                placeholder="e.g. Loan"
                style={inputStyle}
                autoFocus
              />
            </>
          ) : null}

          {kind === 'capability' ? (
            <>
              <label style={labelStyle}>Noun</label>
              <select
                value={capNoun}
                onChange={(e) => setCapNoun(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- pick a noun --</option>
                {nouns.map((n) => (
                  <option key={n.name} value={n.name}>{n.name}</option>
                ))}
              </select>
              <label style={labelStyle}>Verb</label>
              <input
                value={capVerb}
                onChange={(e) => setCapVerb(e.target.value)}
                placeholder="e.g. Approve"
                style={inputStyle}
              />
            </>
          ) : null}

          {kind === 'rule' ? (
            <>
              <label style={labelStyle}>Capability</label>
              <select
                value={ruleCapability}
                onChange={(e) => setRuleCapability(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- pick a capability --</option>
                {capabilities.map((c) => {
                  const name = c.name ?? `${c.noun}.${c.verb}`
                  return <option key={name} value={name}>{name}</option>
                })}
              </select>
              <label style={labelStyle}>Type</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as 'access' | 'condition')}
                style={selectStyle}
              >
                <option value="access">access</option>
                <option value="condition">condition</option>
              </select>
            </>
          ) : null}

          {kind === 'outcome' ? (
            <>
              <label style={labelStyle}>Capability</label>
              <select
                value={outcomeCapability}
                onChange={(e) => setOutcomeCapability(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- pick a capability --</option>
                {capabilities.map((c) => {
                  const name = c.name ?? `${c.noun}.${c.verb}`
                  return <option key={name} value={name}>{name}</option>
                })}
              </select>
              <div style={hintStyle}>
                Adds a default change: <code>status = "new"</code>. Edit in the inspector after creation.
              </div>
            </>
          ) : null}

          {error ? <div style={errorStyle}>{error}</div> : null}
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
          <button onClick={handleSubmit} style={primaryButtonStyle}>Add</button>
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
  border: '1px solid #334155',
  borderRadius: 6,
  width: 380,
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
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop: 4,
}

const inputStyle: React.CSSProperties = {
  background: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  marginTop: 4,
  lineHeight: 1.5,
}

const errorStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 12,
  marginTop: 8,
  padding: '6px 10px',
  background: 'rgba(220, 38, 38, 0.1)',
  border: '1px solid rgba(220, 38, 38, 0.3)',
  borderRadius: 4,
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

const primaryButtonStyle: React.CSSProperties = {
  background: '#3b82f6',
  color: '#fff',
  border: '1px solid #2563eb',
  borderRadius: 4,
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

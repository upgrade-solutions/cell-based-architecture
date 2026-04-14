import { useState, useRef, type KeyboardEvent, type CSSProperties } from 'react'
import type { WidgetProps } from '@rjsf/utils'

/**
 * FlagChipsWidget — custom RJSF 6 widget for string-array fields that
 * should read as tag chips rather than the default stacked text inputs.
 *
 * Integration path
 * ----------------
 * Because the `flags` field is declared as
 *   { type: "array", items: { type: "string" } }
 * RJSF 6 treats it as an array of primitives. You can override the
 * *whole array's* rendering by setting `ui:widget` on the array field
 * itself (not on items). When you do, RJSF hands the widget the full
 * array value via `props.value` and expects it back via `props.onChange`
 * — exactly the shape we want. This is simpler than writing a full
 * `ArrayFieldTemplate` override, which would also have to handle add /
 * remove button wiring manually.
 *
 * Scoping
 * -------
 * We don't register this widget under a generic name (e.g. "StringArray")
 * because that would swallow *every* array of strings in the app. Instead,
 * it's injected via a field-specific `ui:widget` entry on the Rule form's
 * `uiSchema` — see `SchemaForm.tsx` — so only `rule.allow[].flags` uses
 * chip rendering. Other array fields on the Rule and other schemas keep
 * their default vertical rendering.
 *
 * Interaction notes
 * -----------------
 * - Enter or comma commits the current input as a new chip
 * - Duplicates are silently ignored (no error, no dupe)
 * - Leading / trailing whitespace is trimmed on commit
 * - Empty commits are ignored
 * - × on a chip removes it; clicking the chip body does nothing
 * - Backspace on an empty input removes the last chip (common tag-input
 *   affordance — cheap to add, removes a click for keyboard users)
 */
export function FlagChipsWidget(props: WidgetProps) {
  const { id, value, onChange, disabled, readonly } = props
  const flags: string[] = Array.isArray(value) ? (value as string[]) : []
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isLocked = Boolean(disabled || readonly)

  const commit = (raw: string) => {
    const next = raw.trim()
    if (!next) return
    if (flags.includes(next)) {
      // Duplicate — clear the draft without mutating the array.
      setDraft('')
      return
    }
    onChange([...flags, next])
    setDraft('')
  }

  const removeAt = (idx: number) => {
    if (isLocked) return
    const next = flags.slice()
    next.splice(idx, 1)
    onChange(next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isLocked) return
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
      return
    }
    if (e.key === 'Backspace' && draft === '' && flags.length > 0) {
      e.preventDefault()
      removeAt(flags.length - 1)
    }
  }

  const handleBlur = () => {
    // Commit on blur so a user who clicks away doesn't lose an
    // in-progress chip. Matches VS Code tag editors.
    if (draft.trim()) commit(draft)
  }

  return (
    <div className="cba-viz-flag-chips" style={containerStyle}>
      <div style={chipRowStyle}>
        {flags.map((flag, idx) => (
          <span key={`${flag}-${idx}`} style={chipStyle}>
            <span style={chipLabelStyle}>{flag}</span>
            {!isLocked && (
              <button
                type="button"
                aria-label={`Remove flag ${flag}`}
                onClick={() => removeAt(idx)}
                style={chipRemoveStyle}
                tabIndex={-1}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          disabled={isLocked}
          placeholder="Add a flag…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={inputStyle}
        />
      </div>
    </div>
  )
}

// ── styles (inline, dark-theme aware) ──────────────────────────────────
//
// Kept as module constants rather than CSS so the component is
// self-contained — SchemaForm's `.cba-viz-schema-form` CSS scope still
// covers the surrounding label / description / error text, which is
// enough continuity for Phase 5c.4.

const containerStyle: CSSProperties = {
  width: '100%',
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
  minHeight: 28,
  padding: 4,
  background: '#334155', // matches var(--bg-tertiary)
  border: '1px solid #475569', // matches var(--border)
  borderRadius: 3,
  boxSizing: 'border-box',
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  padding: '1px 2px 1px 8px',
  background: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid #10b981',
  color: '#d1fae5',
  borderRadius: 999,
  fontSize: 11,
  lineHeight: '16px',
  maxWidth: '100%',
}

const chipLabelStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const chipRemoveStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#d1fae5',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: '14px',
  padding: '0 4px',
  margin: 0,
  fontFamily: 'inherit',
}

const inputStyle: CSSProperties = {
  flex: '1 1 80px',
  minWidth: 80,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#e2e8f0',
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '2px 4px',
}

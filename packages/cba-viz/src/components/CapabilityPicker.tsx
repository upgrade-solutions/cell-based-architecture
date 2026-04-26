import { useState, useRef, useEffect } from 'react'
import type { Operation } from '../loaders/operational-loader.ts'

interface CapabilityPickerProps {
  /** Operational `Operation[]` — the picker selects by canonical name. */
  operations: Operation[]
  /** Currently selected operation name (`Target.Action`) or null. */
  selected: string | null
  /** Called when the user picks a different operation or clears selection. */
  onChange: (name: string | null) => void
}

/**
 * Floating picker chip for the cross-layer canvas.
 *
 * Conceptually renamed from "capability" to "operation" with the
 * model rewrite — the file name is preserved to keep import sites
 * stable. Picks one of the operations from the operational DNA so the
 * cross-layer canvas can render its full footprint across layers.
 */
export function CapabilityPicker({ operations, selected, onChange }: CapabilityPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  const isEmpty = selected === null

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        onClick={() => setOpen(!open)}
        style={isEmpty ? emptyChipStyle : chipStyle}
        title={isEmpty ? 'Pick an operation to explore across layers' : `Change operation (currently ${selected})`}
      >
        <span>{isEmpty ? 'Pick an operation' : selected}</span>
        <span style={caretStyle}>▾</span>
      </button>

      {open ? (
        <div style={dropdownStyle}>
          {operations.length === 0 ? (
            <div style={emptyDropdownStyle}>No operations in operational DNA</div>
          ) : (
            <>
              {!isEmpty ? (
                <button
                  onClick={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  style={clearItemStyle}
                >
                  Clear selection
                </button>
              ) : null}
              {operations.map((op) => {
                const name = op.name
                const isSelected = name === selected
                return (
                  <button
                    key={op.id ?? name}
                    onClick={() => {
                      onChange(name)
                      setOpen(false)
                    }}
                    style={isSelected ? selectedItemStyle : itemStyle}
                  >
                    {name}
                  </button>
                )
              })}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  zIndex: 10,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
}

const chipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  background: '#1e293b',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
}

const emptyChipStyle: React.CSSProperties = {
  ...chipStyle,
  background: '#1e3a5f',
  border: '1px solid #3b82f6',
  color: '#93c5fd',
  fontFamily: 'inherit',
}

const caretStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 36,
  left: 0,
  minWidth: 220,
  maxHeight: 360,
  overflow: 'auto',
  background: '#1e293b',
  border: '1px solid #475569',
  borderRadius: 4,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  padding: 4,
}

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  background: 'transparent',
  color: '#e2e8f0',
  border: 'none',
  borderRadius: 3,
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  cursor: 'pointer',
  textAlign: 'left',
}

const selectedItemStyle: React.CSSProperties = {
  ...itemStyle,
  background: 'rgba(59, 130, 246, 0.2)',
  color: '#93c5fd',
}

const clearItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  background: 'transparent',
  color: '#fca5a5',
  border: 'none',
  borderRadius: 3,
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  borderBottom: '1px solid #334155',
  marginBottom: 4,
  paddingBottom: 8,
}

const emptyDropdownStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  color: '#64748b',
}

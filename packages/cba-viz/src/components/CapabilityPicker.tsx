import { useState, useRef, useEffect } from 'react'
import type { Capability } from '../loaders/operational-loader.ts'

interface CapabilityPickerProps {
  capabilities: Capability[]
  /** Currently selected capability name (`Noun.Verb`) or null. */
  selected: string | null
  /** Called when the user picks a different capability or clears selection. */
  onChange: (name: string | null) => void
}

/**
 * Floating picker chip for the cross-layer canvas.
 *
 * Absolutely positioned over the top-left of the canvas area. Two
 * states: empty (no capability picked) shows a prominent "Pick a
 * capability ▾" chip; selected shows the compact `Noun.Verb` label.
 * Click in either state toggles a dropdown list of all capabilities
 * from the operational DNA.
 *
 * Rendered as HTML (not as a JointJS element) so the dropdown isn't
 * clipped by the SVG paper. The chip sits in a higher z-order layer
 * than the paper via React portal-free absolute positioning.
 */
export function CapabilityPicker({ capabilities, selected, onChange }: CapabilityPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click. Uses pointerdown so the toggle button's
  // click doesn't immediately re-close the dropdown it just opened.
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
        title={isEmpty ? 'Pick a capability to explore across layers' : `Change capability (currently ${selected})`}
      >
        <span>{isEmpty ? 'Pick a capability' : selected}</span>
        <span style={caretStyle}>▾</span>
      </button>

      {open ? (
        <div style={dropdownStyle}>
          {capabilities.length === 0 ? (
            <div style={emptyDropdownStyle}>No capabilities in operational DNA</div>
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
              {capabilities.map((cap) => {
                const name = cap.name ?? `${cap.noun}.${cap.verb}`
                const isSelected = name === selected
                return (
                  <button
                    key={name}
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

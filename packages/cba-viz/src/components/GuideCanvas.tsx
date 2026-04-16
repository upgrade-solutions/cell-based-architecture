import { useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { loadOperationalDNA, type OperationalDNA } from '../loaders/operational-loader.ts'
import type { GuidePhase, DiscoverState } from './guide/types.ts'
import { extractionsToDna } from './guide/extraction-utils.ts'
import { SAMPLE_DISCOVER_STATE } from './guide/sample-data.ts'
import { GuideDiscover } from './guide/GuideDiscover.tsx'
import { GuideDefine } from './guide/GuideDefine.tsx'
import { GuideDesign } from './guide/GuideDesign.tsx'

// The Guide tab is a simulation using the Marshall Fire mass-tort case. It
// always loads marshall DNA regardless of the current domain — Discover shows
// the sample transcript + extractions, Define/Design render the full marshall
// DNA so all three phases tell the same story.
const GUIDE_DOMAIN = 'torts/marshall'

interface GuideCanvasProps {
  operationalDna: OperationalDNA | null
}

const PHASES: { key: GuidePhase; label: string; description: string }[] = [
  { key: 'discover', label: 'Discover', description: 'Input source material and extract primitives' },
  { key: 'define', label: 'Define', description: 'Structure and refine Operational DNA' },
  { key: 'design', label: 'Design', description: 'Generate SOPs, diagrams, and product summaries' },
]

export const GuideCanvas = observer(function GuideCanvas({ operationalDna }: GuideCanvasProps) {
  const [phase, setPhase] = useState<GuidePhase>('discover')
  const [discoverState, setDiscoverState] = useState<DiscoverState>(SAMPLE_DISCOVER_STATE)
  const [workingDna, setWorkingDna] = useState<OperationalDNA | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Always load marshall DNA for the Guide simulation. If the current domain
  // already IS marshall, we could reuse the prop — but loading fresh keeps
  // the Guide isolated from edits in other tabs during the session.
  useEffect(() => {
    let cancelled = false
    loadOperationalDNA(GUIDE_DOMAIN)
      .then((dna) => { if (!cancelled) setWorkingDna(dna) })
      .catch((err) => { if (!cancelled) setLoadError(String(err?.message ?? err)) })
    return () => { cancelled = true }
  }, [])

  const handleProceedToDefine = useCallback(() => {
    const merged = extractionsToDna(discoverState.extractions, workingDna)
    setWorkingDna(merged)
    setPhase('define')
  }, [discoverState.extractions, workingDna])

  const activeDna = workingDna
  void operationalDna

  return (
    <div style={containerStyle}>
      {/* Phase indicator */}
      <div style={phaseBarStyle}>
        {PHASES.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setPhase(p.key)}
            style={phase === p.key ? activePhaseStyle : phaseButtonStyle}
            title={p.description}
          >
            <span style={phaseNumberStyle}>{i + 1}</span>
            <span style={phaseLabelStyle}>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Phase content */}
      <div style={contentStyle}>
        {phase === 'discover' && (
          <GuideDiscover
            state={discoverState}
            onChange={setDiscoverState}
            onProceed={handleProceedToDefine}
          />
        )}
        {phase === 'define' && activeDna && (
          <GuideDefine
            dna={activeDna}
            onChange={setWorkingDna}
          />
        )}
        {phase === 'define' && !activeDna && (
          <div style={emptyStyle}>
            {loadError ? `Failed to load Marshall DNA: ${loadError}` : 'Loading Marshall Fire Operational DNA…'}
          </div>
        )}
        {phase === 'design' && activeDna && (
          <GuideDesign dna={activeDna} />
        )}
        {phase === 'design' && !activeDna && (
          <div style={emptyStyle}>
            {loadError ? `Failed to load Marshall DNA: ${loadError}` : 'Loading Marshall Fire Operational DNA…'}
          </div>
        )}
      </div>
    </div>
  )
})

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#0f172a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const phaseBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  padding: '12px 24px',
  borderBottom: '1px solid #1e293b',
  flexShrink: 0,
}

const phaseButtonBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 20px',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
  fontSize: 13,
  fontWeight: 500,
  transition: 'background 0.15s',
}

const phaseButtonStyle: React.CSSProperties = {
  ...phaseButtonBase,
  background: 'transparent',
  color: '#64748b',
}

const activePhaseStyle: React.CSSProperties = {
  ...phaseButtonBase,
  background: '#1e293b',
  color: '#f1f5f9',
}

const phaseNumberStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  background: '#334155',
  color: '#e2e8f0',
}

const phaseLabelStyle: React.CSSProperties = {
  fontWeight: 600,
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: 24,
  overflow: 'hidden',
  minHeight: 0,
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#475569',
  fontSize: 14,
  fontFamily: '-apple-system, sans-serif',
  textAlign: 'center',
  lineHeight: 1.6,
}

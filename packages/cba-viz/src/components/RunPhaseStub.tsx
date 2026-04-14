interface RunPhaseStubProps {
  /** Sub-tab title — e.g. "Logs", "Metrics", "Access controls". */
  title: string
  /** One-paragraph description of what this surface will contain. */
  description: string
  /** Roadmap phase identifier (e.g. "5c.6") rendered as a muted tag. */
  phase: string
}

/**
 * Placeholder card for Run sub-tabs that aren't implemented yet.
 *
 * Shows the user what's planned without hiding it from the IA. The
 * alternative — disabling or omitting the tabs — would make the
 * future roadmap invisible and defer the information-architecture
 * decision. Better to land the nav now and fill in behind the tabs
 * as each phase ships.
 */
export function RunPhaseStub({ title, description, phase }: RunPhaseStubProps) {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={phaseTagStyle}>{phase}</div>
        <h1 style={titleStyle}>{title}</h1>
        <p style={descriptionStyle}>{description}</p>
        <div style={badgeStyle}>Not yet implemented</div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0f172a',
  backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
  backgroundSize: '10px 10px',
}

const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  padding: 32,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  textAlign: 'center',
}

const phaseTagStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  background: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid #3b82f6',
  borderRadius: 3,
  color: '#93c5fd',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 16,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 18,
  fontWeight: 700,
  color: '#f8fafc',
}

const descriptionStyle: React.CSSProperties = {
  margin: '0 0 20px 0',
  fontSize: 13,
  color: '#94a3b8',
  lineHeight: 1.6,
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  background: 'rgba(100, 116, 139, 0.2)',
  border: '1px solid #475569',
  borderRadius: 3,
  color: '#64748b',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

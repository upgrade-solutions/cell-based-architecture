import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'

// ── Phase + Sub types ───────────────────────────────────────────────────
//
// The toolbar navigates on two axes: the lifecycle Phase (Build vs Run)
// and a Sub-tab within that phase. Build maps to authoring surfaces
// (DNA layers + cross-layer view), Run maps to runtime observation
// (deployment + future logs/metrics/access). Deploy isn't its own
// phase — it's a brief transition at the head of Run.

export type Phase = 'build' | 'run'

export type BuildSub =
  | 'operational'
  | 'product-core'
  | 'product-api'
  | 'product-ui'
  | 'technical'
  | 'cross-layer'

export type RunSub =
  | 'deployment'
  | 'logs'
  | 'metrics'
  | 'access'

export type Sub = BuildSub | RunSub

export const BUILD_SUBS: BuildSub[] = [
  'operational',
  'product-core',
  'product-api',
  'product-ui',
  'technical',
  'cross-layer',
]

export const RUN_SUBS: RunSub[] = [
  'deployment',
  'logs',
  'metrics',
  'access',
]

/** Default landing sub per phase. */
export const DEFAULT_BUILD_SUB: BuildSub = 'operational'
export const DEFAULT_RUN_SUB: RunSub = 'deployment'

/** Human-readable labels. */
export function subLabel(sub: Sub): string {
  switch (sub) {
    case 'operational':  return 'Operational'
    case 'product-core': return 'Product Core'
    case 'product-api':  return 'Product API'
    case 'product-ui':   return 'Product UI'
    case 'technical':    return 'Technical'
    case 'cross-layer':  return 'Cross-layer'
    case 'deployment':   return 'Deployment'
    case 'logs':         return 'Logs'
    case 'metrics':      return 'Metrics'
    case 'access':       return 'Access'
  }
}

/** Tooltip describing what the sub-tab contains. */
function subTitle(sub: Sub): string {
  switch (sub) {
    case 'operational':  return 'Operational DNA — business logic, Nouns, Capabilities, Rules, Outcomes, Signals'
    case 'product-core': return 'Product Core — materialized operational subset that product surfaces consume'
    case 'product-api':  return 'Product API — namespace, resources, endpoints'
    case 'product-ui':   return 'Product UI — layout, pages, blocks'
    case 'technical':    return 'Technical DNA — cells, constructs, providers, environments'
    case 'cross-layer':  return 'Cross-layer — a single capability across operational, product API, and product UI'
    case 'deployment':   return 'Live deployment state — docker-compose or terraform/aws status polling'
    case 'logs':         return 'Log aggregation (coming soon)'
    case 'metrics':      return 'Metrics dashboards (coming soon)'
    case 'access':       return 'Access controls (coming soon)'
  }
}

/** Is this sub-tab a stub (not yet implemented)? */
export function isStubSub(sub: Sub): boolean {
  return sub === 'logs' || sub === 'metrics' || sub === 'access'
}

interface ToolbarProps {
  model: GraphModel
  viewNames: string[]
  currentView: string
  onViewChange: (name: string) => void
  onSave: () => void
  saving: boolean
  domain: string
  env: string
  onEnvChange: (env: string) => void
  phase: Phase
  sub: Sub
  onPhaseChange: (phase: Phase) => void
  onSubChange: (sub: Sub) => void
}

/**
 * Two-row toolbar.
 *
 *   Row 1: domain · Build/Run phase tabs · env + view (only for Run > Deployment)
 *          · flex spacer · zoom/fit/save
 *   Row 2: sub-tab strip for the active phase
 *
 * Phase is the primary navigation axis (what am I doing? building or
 * running?); Sub is the secondary (which specific surface within that
 * phase). Splitting the old flat layer strip into (phase, sub) keeps
 * the IA scalable — Run will grow to 4–6 sub-tabs as observability
 * surfaces ship.
 */
export const Toolbar = observer(function Toolbar({
  model,
  viewNames,
  currentView,
  onViewChange,
  onSave,
  saving,
  domain,
  env,
  onEnvChange,
  phase,
  sub,
  onPhaseChange,
  onSubChange,
}: ToolbarProps) {
  const scalePercent = Math.round(model.scale * 100)

  const handleFitToContent = () => {
    model.paper?.scaleContentToFit({
      padding: 60,
      minScale: 0.2,
      maxScale: 1.5,
    })
    model.setScale(model.paper?.scale().sx ?? 1)
  }

  // Env + view selectors are meaningful only for Run > Deployment —
  // that's the only place the environment overlay + saved technical
  // views actually drive what's rendered. Operational, Product, and
  // Build > Technical don't care.
  const showEnvView = phase === 'run' && sub === 'deployment'

  // Sub-tab list for the active phase.
  const subs: Sub[] = phase === 'build' ? BUILD_SUBS : RUN_SUBS

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        fontSize: 13,
      }}
    >
      {/* Row 1 — domain, phase tabs, (conditional) env/view, zoom, save */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
        }}
      >
        {/* Domain label */}
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13 }}>{domain}</span>

        <div style={{ width: 1, height: 20, background: '#475569' }} />

        {/* Phase tabs — Build | Run. The primary navigation axis. */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => onPhaseChange('build')}
            style={phase === 'build' ? activePhaseTabStyle : phaseTabStyle}
            title="Build — authoring DNA, generated artifacts, cross-layer exploration"
          >
            Build
          </button>
          <button
            onClick={() => onPhaseChange('run')}
            style={phase === 'run' ? activePhaseTabStyle : phaseTabStyle}
            title="Run — deployment state, runtime observation, access controls"
          >
            Run
          </button>
        </div>

        {showEnvView ? (
          <>
            <div style={{ width: 1, height: 20, background: '#475569' }} />

            <label style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Env
            </label>
            <select
              value={env}
              onChange={(e) => onEnvChange(e.target.value)}
              style={selectStyle}
            >
              <option value="dev">dev</option>
              <option value="prod">prod</option>
            </select>

            <div style={{ width: 1, height: 20, background: '#475569' }} />

            <label style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              View
            </label>
            <select
              value={currentView}
              onChange={(e) => onViewChange(e.target.value)}
              style={selectStyle}
            >
              {viewNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </>
        ) : null}

        <div style={{ flex: 1 }} />

        {/* Zoom controls */}
        <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 40, textAlign: 'center' }}>
          {scalePercent}%
        </span>
        <button
          onClick={handleFitToContent}
          style={buttonStyle}
          title="Fit to content"
        >
          Fit
        </button>

        <div style={{ width: 1, height: 20, background: '#475569' }} />

        {/* Save */}
        <button
          onClick={onSave}
          disabled={!model.dirty || saving}
          style={{
            ...buttonStyle,
            background: model.dirty ? '#3b82f6' : '#334155',
            color: model.dirty ? '#fff' : '#64748b',
            cursor: model.dirty ? 'pointer' : 'default',
          }}
          title={model.dirty ? 'Save changes' : 'No changes to save'}
        >
          {saving ? 'Saving...' : model.dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Row 2 — sub-tab strip for the active phase */}
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '0 16px',
          background: '#17202f',
          borderTop: '1px solid #0f172a',
        }}
      >
        {subs.map((s) => (
          <button
            key={s}
            onClick={() => onSubChange(s)}
            style={sub === s ? activeSubTabStyle : subTabStyle}
            title={subTitle(s)}
          >
            {subLabel(s)}
            {isStubSub(s) ? <span style={stubMarkStyle}>·</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
})

// ── Styles ──────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const buttonStyle: React.CSSProperties = {
  background: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const phaseTabStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #334155',
  borderRadius: 4,
  padding: '4px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const activePhaseTabStyle: React.CSSProperties = {
  ...phaseTabStyle,
  background: '#1e3a5f',
  color: '#f8fafc',
  border: '1px solid #3b82f6',
}

const subTabStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid transparent',
  borderRadius: 3,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const activeSubTabStyle: React.CSSProperties = {
  ...subTabStyle,
  background: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
}

const stubMarkStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 14,
  lineHeight: '8px',
  marginLeft: 2,
}

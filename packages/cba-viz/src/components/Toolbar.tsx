import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'

export type Layer = 'technical' | 'operational'

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
  layer: Layer
  onLayerChange: (layer: Layer) => void
}

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
  layer,
  onLayerChange,
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

  return (
    <div
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        fontSize: 13,
      }}
    >
      {/* Domain label */}
      <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13 }}>{domain}</span>

      <div style={{ width: 1, height: 20, background: '#475569' }} />

      {/* Layer tabs — Technical | Operational. Drives which canvas
          component App.tsx renders and which save handler Ctrl+S invokes. */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          onClick={() => onLayerChange('technical')}
          style={layer === 'technical' ? activeTabStyle : tabStyle}
          title="Technical DNA — deployment graph"
        >
          Technical
        </button>
        <button
          onClick={() => onLayerChange('operational')}
          style={layer === 'operational' ? activeTabStyle : tabStyle}
          title="Operational DNA — business logic"
        >
          Operational
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: '#475569' }} />

      {/* Environment + View selectors only apply to the technical layer.
          Operational DNA is environment-agnostic (it's the business logic),
          and there's only one operational "view" per domain, so hiding the
          controls avoids confusing no-op selectors. */}
      {layer === 'technical' ? (
        <>
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
        title={model.dirty ? 'Save changes to architecture.json' : 'No changes to save'}
      >
        {saving ? 'Saving...' : model.dirty ? 'Save' : 'Saved'}
      </button>
    </div>
  )
})

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

const tabStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #334155',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
}

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: '#1e3a5f',
  color: '#f8fafc',
  border: '1px solid #3b82f6',
}

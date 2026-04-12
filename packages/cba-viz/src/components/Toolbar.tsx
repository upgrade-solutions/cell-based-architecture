import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'

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
  adapter: string
  onAdapterChange: (adapter: string) => void
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
  adapter,
  onAdapterChange,
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

      {/* Environment selector */}
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

      {/* View selector */}
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

      <div style={{ width: 1, height: 20, background: '#475569' }} />

      {/* Adapter selector */}
      <label style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Status
      </label>
      <select
        value={adapter}
        onChange={(e) => onAdapterChange(e.target.value)}
        style={selectStyle}
      >
        <option value="docker-compose">Docker Compose</option>
        <option value="terraform/aws">Terraform / AWS</option>
      </select>

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

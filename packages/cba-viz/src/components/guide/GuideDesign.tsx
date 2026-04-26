import { useState } from 'react'
import type { OperationalDNA, Domain, NounLike, ProcessStep } from '../../loaders/operational-loader.ts'
import { GuideDefine } from './GuideDefine.tsx'
import { GuidePlan } from './GuidePlan.tsx'

interface GuideDesignProps {
  dna: OperationalDNA
}

type DesignTab = 'summary' | 'sops' | 'flows' | 'plan' | 'api' | 'ui'

const TABS: { key: DesignTab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'sops', label: 'SOPs' },
  { key: 'flows', label: 'Process Flows' },
  { key: 'plan', label: 'Plan' },
  { key: 'api', label: 'Product API' },
  { key: 'ui', label: 'Product UI' },
]

export function GuideDesign({ dna }: GuideDesignProps) {
  const [tab, setTab] = useState<DesignTab>('summary')
  const processes = dna.processes ?? []
  const tasks = dna.tasks ?? []
  const roles = collectRoles(dna.domain)
  const resources = collectResources(dna.domain)
  const operations = dna.operations ?? []
  const rules = dna.rules ?? []

  return (
    <div style={containerStyle}>
      {/* Sub-tab nav */}
      <div style={tabBarStyle}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={tab === t.key ? activeTabStyle : tabStyle}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={tabContentStyle}>
      {/* Summary (formerly the Define phase) */}
      {tab === 'summary' && (
        <GuideDefine dna={dna} onChange={() => { /* read-only in Design phase */ }} />
      )}

      {/* SOPs */}
      {tab === 'sops' && (
      <div style={sectionStyle}>
        {processes.length === 0 ? (
          <div style={emptyStyle}>No processes defined. Define processes in the Define phase to generate SOPs.</div>
        ) : (
          processes.map((proc) => (
            <div key={proc.name} style={sopCardStyle}>
              <div style={sopHeaderStyle}>
                <div style={sopTitleRowStyle}>
                  <span style={sopNameStyle}>{proc.name}</span>
                  <span style={sopOperatorStyle}>Operator: {proc.operator}</span>
                </div>
                {proc.description && <p style={sopDescStyle}>{proc.description}</p>}
              </div>

              <div style={sopStepsStyle}>
                <div style={sopStepsHeaderStyle}>Procedure Steps</div>
                {proc.steps.map((step, i) => {
                  const task = tasks.find((t) => t.name === step.task)
                  const deps = step.depends_on ?? []
                  return (
                    <div key={step.id} style={sopStepStyle}>
                      <div style={stepNumberStyle}>{i + 1}</div>
                      <div style={stepContentStyle}>
                        <div style={stepMainStyle}>
                          <span style={stepIdBadgeStyle}>{step.id}</span>
                          {task ? (
                            <span style={stepResolvedStyle}>
                              <strong>{task.actor}</strong> performs <strong>{task.operation}</strong>
                            </span>
                          ) : (
                            <span style={stepTaskRefStyle}>{step.task}</span>
                          )}
                        </div>
                        {step.description && <div style={stepDescStyle}>{step.description}</div>}
                        {deps.length > 0 && (
                          <div style={stepDepsStyle}>Requires: {deps.join(', ')}</div>
                        )}
                        {step.else && (
                          <div style={branchBoxStyle}>
                            <span style={branchElseStyle}>ELSE → {step.else}</span>
                          </div>
                        )}
                        {task && (() => {
                          const opRules = rules.filter((r) => r.operation === task.operation)
                          if (opRules.length === 0) return null
                          return (
                            <div style={rulesBoxStyle}>
                              {opRules.map((r, ri) => (
                                <div key={ri} style={ruleLineStyle}>
                                  <span style={ruleTypeBadgeStyle}>{r.type}</span>
                                  <span style={ruleDescStyle}>{r.description ?? 'No description'}</span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Process Flows */}
      {tab === 'flows' && (
      <div style={sectionStyle}>
        {processes.map((proc) => {
          const layers = topoSort(proc.steps)
          return (
            <div key={proc.name} style={flowCardStyle}>
              <div style={flowTitleStyle}>{proc.name}</div>
              <div style={flowGridStyle}>
                {layers.map((layer, li) => (
                  <div key={li} style={flowLayerStyle}>
                    {li > 0 && <div style={flowArrowStyle}>→</div>}
                    <div style={flowColumnStyle}>
                      {layer.map((step) => {
                        const task = tasks.find((t) => t.name === step.task)
                        return (
                          <div key={step.id} style={flowStepStyle}>
                            <div style={flowStepIdStyle}>{step.id}</div>
                            <div style={flowStepPosStyle}>{task?.actor ?? '?'}</div>
                            {step.else && <div style={flowBranchStyle}>◆</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {processes.length === 0 && (
          <div style={emptyStyle}>No processes defined.</div>
        )}
      </div>
      )}

      {/* Plan (Gantt) */}
      {tab === 'plan' && (
        <GuidePlan dna={dna} />
      )}

      {/* Product API */}
      {tab === 'api' && (
      <div style={sectionStyle}>
        <p style={productIntroStyle}>REST surface derived from the domain's Resources and Operations.</p>

        {/* Roles — auth inputs */}
        <div style={productSubsectionStyle}>
          <div style={productSubtitleStyle}>Roles (for auth middleware)</div>
          <div style={chipGridStyle}>
            {roles.map((r) => (
              <span key={r.name} style={roleChipStyle}>{r.name}</span>
            ))}
          </div>
        </div>

        <div style={productSubsectionStyle}>
          <div style={productSubtitleStyle}>Endpoints</div>
          <table style={apiTableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Resource</th>
                <th style={thStyle}>Endpoint</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Operation</th>
                <th style={thStyle}>Allowed Roles</th>
              </tr>
            </thead>
            <tbody>
              {resources.flatMap((res) => {
                const resOps = operations.filter((o) => o.target === res.name)
                if (resOps.length === 0) {
                  return [
                    <tr key={res.name}>
                      <td style={tdStyle}>{res.name}</td>
                      <td style={tdStyle}>{`/${toKebab(res.name)}s`}</td>
                      <td style={tdStyle}>GET</td>
                      <td style={tdMutedStyle}>list (implicit)</td>
                      <td style={tdMutedStyle}>—</td>
                    </tr>,
                  ]
                }
                return resOps.map((op) => {
                  const accessRules = rules.filter((r) => r.operation === op.name && r.type === 'access')
                  const allowedRoles = accessRules.flatMap((r) => (r.allow ?? []).map((a) => a.role).filter(Boolean) as string[])
                  return (
                    <tr key={op.name}>
                      <td style={tdStyle}>{op.target}</td>
                      <td style={tdStyle}>{suggestEndpoint(op.target, op.action)}</td>
                      <td style={tdStyle}>{suggestMethod(op.action)}</td>
                      <td style={tdStyle}>{op.name}</td>
                      <td style={tdStyle}>{allowedRoles.length > 0 ? allowedRoles.join(', ') : <span style={{ color: '#475569', fontStyle: 'italic' }}>—</span>}</td>
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Product UI */}
      {tab === 'ui' && (
      <div style={sectionStyle}>
        <p style={productIntroStyle}>Suggested pages and blocks derived from the domain's Resources and Operations.</p>

        <div style={productSubsectionStyle}>
          <div style={productSubtitleStyle}>Pages</div>
          <div style={uiGridStyle}>
            {resources.map((res) => {
              const resOps = operations.filter((o) => o.target === res.name)
              return (
                <div key={res.name} style={uiPageCardStyle}>
                  <div style={uiPageNameStyle}>{res.name}</div>
                  <div style={uiPageRouteStyle}>/{toKebab(res.name)}s</div>
                  <div style={uiBlocksStyle}>
                    <span style={uiBlockStyle}>list</span>
                    <span style={uiBlockStyle}>detail</span>
                    {resOps.some((o) => isWriteAction(o.action)) && <span style={uiBlockStyle}>form</span>}
                    {resOps.length > 1 && <span style={uiBlockStyle}>actions</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={productSubsectionStyle}>
          <div style={productSubtitleStyle}>Navigation</div>
          <div style={chipGridStyle}>
            {processes.map((p) => (
              <span key={p.name} style={navChipStyle}>/{toKebab(p.name)}</span>
            ))}
          </div>
        </div>
      </div>
      )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function collectResources(domain: Domain): NounLike[] {
  const out: NounLike[] = []
  walkResources(domain, (r) => out.push(r))
  return out
}

function collectRoles(domain: Domain): NounLike[] {
  const out: NounLike[] = []
  walkRoles(domain, (r) => out.push(r))
  return out
}

function walkResources(domain: Domain, fn: (n: NounLike) => void): void {
  for (const r of domain.resources ?? []) fn(r)
  for (const sub of domain.domains ?? []) walkResources(sub, fn)
}

function walkRoles(domain: Domain, fn: (n: NounLike) => void): void {
  for (const r of domain.roles ?? []) fn(r)
  for (const sub of domain.domains ?? []) walkRoles(sub, fn)
}

function topoSort(steps: ProcessStep[]): ProcessStep[][] {
  const layers: ProcessStep[][] = []
  const placed = new Set<string>()
  const remaining = [...steps]

  while (remaining.length > 0) {
    const layer = remaining.filter((s) =>
      (s.depends_on ?? []).every((d) => placed.has(d)),
    )
    if (layer.length === 0) {
      layers.push(remaining.splice(0))
      break
    }
    for (const s of layer) {
      placed.add(s.id)
      remaining.splice(remaining.indexOf(s), 1)
    }
    layers.push(layer)
  }
  return layers
}

function toKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

function suggestMethod(action: string): string {
  const v = action.toLowerCase()
  if (v === 'view' || v === 'list' || v === 'get') return 'GET'
  if (v === 'delete' || v === 'remove') return 'DELETE'
  if (v === 'update' || v === 'updatestatus' || v === 'advance' || v === 'activate' || v === 'deactivate' || v === 'assign' || v === 'verify' || v === 'assess') return 'PATCH'
  return 'POST'
}

function suggestEndpoint(target: string, action: string): string {
  const base = `/${toKebab(target)}s`
  const v = action.toLowerCase()
  if (v === 'list' || v === 'register' || v === 'submit' || v === 'file' || v === 'apply' || v === 'onboard' || v === 'upload') return base
  return `${base}/:id/${toKebab(action)}`
}

function isWriteAction(action: string): boolean {
  const v = action.toLowerCase()
  return !['view', 'list', 'get'].includes(v)
}

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex', gap: 2, borderBottom: '1px solid #334155', flexShrink: 0,
}

const tabBase: React.CSSProperties = {
  padding: '8px 16px', fontSize: 12, fontWeight: 500, background: 'transparent',
  border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif', marginBottom: -1,
}

const tabStyle: React.CSSProperties = { ...tabBase, color: '#64748b' }

const activeTabStyle: React.CSSProperties = {
  ...tabBase, color: '#f1f5f9', borderBottomColor: '#f59e0b',
}

const tabContentStyle: React.CSSProperties = {
  flex: 1, overflow: 'auto', paddingTop: 16, minHeight: 0,
}

const sectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12,
}

const emptyStyle: React.CSSProperties = {
  padding: 24, color: '#475569', fontSize: 13, fontFamily: '-apple-system, sans-serif',
  background: '#1e293b', borderRadius: 8, border: '1px dashed #334155', textAlign: 'center',
}

// ── SOP styles ──────────────────────────────────────────────────────────

const sopCardStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden',
}

const sopHeaderStyle: React.CSSProperties = {
  padding: '16px 20px 12px', borderBottom: '1px solid #334155',
}

const sopTitleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 12,
}

const sopNameStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: '#f59e0b', fontFamily: 'ui-monospace, monospace',
}

const sopOperatorStyle: React.CSSProperties = {
  fontSize: 11, color: '#8b5cf6', fontFamily: 'ui-monospace, monospace',
}

const sopDescStyle: React.CSSProperties = {
  margin: '6px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5,
  fontFamily: '-apple-system, sans-serif',
}

const sopStepsStyle: React.CSSProperties = {
  padding: '12px 20px 16px',
}

const sopStepsHeaderStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 10, fontFamily: '-apple-system, sans-serif',
}

const sopStepStyle: React.CSSProperties = {
  display: 'flex', gap: 12, marginBottom: 10,
}

const stepNumberStyle: React.CSSProperties = {
  width: 24, height: 24, minWidth: 24, borderRadius: '50%',
  background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700, color: '#e2e8f0',
}

const stepContentStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
}

const stepMainStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
}

const stepIdBadgeStyle: React.CSSProperties = {
  padding: '1px 6px', fontSize: 10, fontWeight: 600, color: '#8b5cf6',
  background: '#1e1b4b', borderRadius: 3, fontFamily: 'ui-monospace, monospace',
}

const stepResolvedStyle: React.CSSProperties = {
  fontSize: 12, color: '#e2e8f0', fontFamily: '-apple-system, sans-serif',
}

const stepTaskRefStyle: React.CSSProperties = {
  fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace, monospace',
}

const stepDescStyle: React.CSSProperties = {
  fontSize: 11, color: '#94a3b8', fontFamily: '-apple-system, sans-serif',
}

const stepDepsStyle: React.CSSProperties = {
  fontSize: 10, color: '#64748b', fontFamily: 'ui-monospace, monospace',
}

const branchBoxStyle: React.CSSProperties = {
  display: 'flex', gap: 12, padding: '4px 8px',
  background: '#1c1917', border: '1px solid #451a03', borderRadius: 4,
  fontSize: 10, fontFamily: 'ui-monospace, monospace',
}

const branchElseStyle: React.CSSProperties = { color: '#ef4444' }

const rulesBoxStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2,
}

const ruleLineStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 10,
}

const ruleTypeBadgeStyle: React.CSSProperties = {
  padding: '0 4px', fontSize: 9, fontWeight: 600, color: '#06b6d4',
  background: '#0c4a6e', borderRadius: 2, fontFamily: 'ui-monospace, monospace',
}

const ruleDescStyle: React.CSSProperties = {
  color: '#64748b', fontFamily: '-apple-system, sans-serif',
}

// ── Flow diagram styles ─────────────────────────────────────────────────

const flowCardStyle: React.CSSProperties = {
  padding: '16px 20px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
}

const flowTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 12,
  fontFamily: 'ui-monospace, monospace',
}

const flowGridStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 8,
}

const flowLayerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
}

const flowArrowStyle: React.CSSProperties = {
  padding: '0 8px', fontSize: 16, color: '#475569',
}

const flowColumnStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
}

const flowStepStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 4, minWidth: 100, textAlign: 'center', position: 'relative',
}

const flowStepIdStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace',
}

const flowStepPosStyle: React.CSSProperties = {
  fontSize: 9, color: '#8b5cf6', fontFamily: 'ui-monospace, monospace',
}

const flowBranchStyle: React.CSSProperties = {
  position: 'absolute', top: 2, right: 4, fontSize: 8, color: '#f59e0b',
}

// ── Product DNA styles ──────────────────────────────────────────────────

const productIntroStyle: React.CSSProperties = {
  margin: 0, fontSize: 12, color: '#94a3b8', fontFamily: '-apple-system, sans-serif',
}

const productSubsectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
}

const productSubtitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#cbd5e1', fontFamily: '-apple-system, sans-serif',
}

const chipGridStyle: React.CSSProperties = {
  display: 'flex', gap: 6, flexWrap: 'wrap',
}

const roleChipStyle: React.CSSProperties = {
  padding: '2px 8px', fontSize: 11, fontWeight: 500, color: '#06b6d4',
  border: '1px solid #06b6d4', borderRadius: 4, fontFamily: 'ui-monospace, monospace',
}

const apiTableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 11,
  fontFamily: 'ui-monospace, monospace',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #334155',
  color: '#64748b', fontWeight: 600, fontSize: 10,
}

const tdStyle: React.CSSProperties = {
  padding: '4px 10px', borderBottom: '1px solid #1e293b', color: '#cbd5e1',
}

const tdMutedStyle: React.CSSProperties = {
  ...tdStyle, color: '#475569', fontStyle: 'italic',
}

const uiGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8,
}

const uiPageCardStyle: React.CSSProperties = {
  padding: '10px 12px', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6,
}

const uiPageNameStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace',
}

const uiPageRouteStyle: React.CSSProperties = {
  fontSize: 10, color: '#475569', fontFamily: 'ui-monospace, monospace',
}

const navChipStyle: React.CSSProperties = {
  padding: '2px 8px', fontSize: 11, fontWeight: 500, color: '#f59e0b',
  border: '1px solid #f59e0b', borderRadius: 4, fontFamily: 'ui-monospace, monospace',
}

const uiBlocksStyle: React.CSSProperties = {
  display: 'flex', gap: 4, flexWrap: 'wrap',
}

const uiBlockStyle: React.CSSProperties = {
  padding: '1px 6px', fontSize: 9, color: '#94a3b8',
  background: '#0f172a', borderRadius: 3, fontFamily: 'ui-monospace, monospace',
}

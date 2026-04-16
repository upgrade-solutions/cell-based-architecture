import { observer } from 'mobx-react-lite'
import type { OperationalDNA } from '../loaders/operational-loader.ts'

interface GuideCanvasProps {
  operationalDna: OperationalDNA | null
}

interface PhaseConfig {
  number: number
  title: string
  question: string
  primitives: string[]
  color: string
  description: string
}

const PHASES: PhaseConfig[] = [
  {
    number: 1,
    title: 'Domain & Entities',
    question: 'What does the business track?',
    primitives: ['Domain', 'Noun', 'Attribute'],
    color: '#64748b',
    description: 'Identify the bounded context and the core entities the business manages. Each Noun gets a name, description, and typed attributes.',
  },
  {
    number: 2,
    title: 'Actions & Capabilities',
    question: 'What can be done to those entities?',
    primitives: ['Verb', 'Capability'],
    color: '#10b981',
    description: 'For each Noun, discover the Verbs (actions). Each Noun:Verb pair becomes a Capability — the atomic unit of business activity.',
  },
  {
    number: 3,
    title: 'Organization & Tasks',
    question: 'Who does the work?',
    primitives: ['Position', 'Person', 'Task'],
    color: '#8b5cf6',
    description: 'Map the org chart as Positions, assign Roles (Product Core), and pair each Position with a Capability to create reusable Tasks.',
  },
  {
    number: 4,
    title: 'Processes & SOPs',
    question: 'In what order?',
    primitives: ['Process', 'Step'],
    color: '#f59e0b',
    description: 'Compose Tasks into Processes — ordered DAGs of Steps with dependencies and branching. Each Process is a Standard Operating Procedure.',
  },
  {
    number: 5,
    title: 'Rules & Constraints',
    question: 'Who can do it, and when?',
    primitives: ['Rule', 'Role'],
    color: '#06b6d4',
    description: 'Define access rules (which Roles may invoke a Capability) and condition rules (what state must be true). Roles live in Product Core DNA.',
  },
  {
    number: 6,
    title: 'Triggers & Effects',
    question: 'What starts it, and what happens after?',
    primitives: ['Cause', 'Outcome', 'Signal'],
    color: '#f43f5e',
    description: 'Causes initiate Capabilities (user action, schedule, webhook, signal). Outcomes record state changes and emit Signals for cross-domain communication.',
  },
  {
    number: 7,
    title: 'Relationships & Equations',
    question: 'How do entities connect? What needs computing?',
    primitives: ['Relationship', 'Equation'],
    color: '#a855f7',
    description: 'Formalize references between Nouns with cardinality. Define technology-agnostic computations that cannot be expressed as declarative Rules.',
  },
]

function countPrimitives(dna: OperationalDNA | null): Record<string, number> {
  if (!dna) return {}
  const counts: Record<string, number> = {}
  const countNouns = (domain: any): number => {
    let n = (domain.nouns ?? []).length
    for (const sub of domain.domains ?? []) n += countNouns(sub)
    return n
  }
  const countVerbs = (domain: any): number => {
    let n = 0
    for (const noun of domain.nouns ?? []) n += (noun.verbs ?? []).length
    for (const sub of domain.domains ?? []) n += countVerbs(sub)
    return n
  }
  const countAttrs = (domain: any): number => {
    let n = 0
    for (const noun of domain.nouns ?? []) n += (noun.attributes ?? []).length
    for (const sub of domain.domains ?? []) n += countAttrs(sub)
    return n
  }
  counts['Noun'] = countNouns(dna.domain)
  counts['Verb'] = countVerbs(dna.domain)
  counts['Attribute'] = countAttrs(dna.domain)
  counts['Domain'] = 1
  counts['Capability'] = (dna.capabilities ?? []).length
  counts['Position'] = (dna.positions ?? []).length
  counts['Person'] = (dna.persons ?? []).length
  counts['Task'] = (dna.tasks ?? []).length
  counts['Process'] = (dna.processes ?? []).length
  counts['Step'] = (dna.processes ?? []).reduce((sum, p) => sum + (p.steps?.length ?? 0), 0)
  counts['Rule'] = (dna.rules ?? []).length
  counts['Role'] = 0
  counts['Cause'] = (dna.causes ?? []).length
  counts['Outcome'] = (dna.outcomes ?? []).length
  counts['Signal'] = (dna.signals ?? []).length
  counts['Relationship'] = (dna.relationships ?? []).length
  counts['Equation'] = (dna.equations ?? []).length
  return counts
}

export const GuideCanvas = observer(function GuideCanvas({ operationalDna }: GuideCanvasProps) {
  const counts = countPrimitives(operationalDna)

  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Discovery Guide</h2>
          <p style={subtitleStyle}>
            From stakeholder conversation to Operational DNA — follow these phases in order.
            Each phase surfaces a set of primitives. The count badges show what's already defined.
          </p>
        </div>

        <div style={flowStyle}>
          {PHASES.map((phase, i) => (
            <div key={phase.number} style={phaseRowStyle}>
              {/* Connector line */}
              {i > 0 && <div style={connectorStyle} />}

              {/* Phase card */}
              <div style={cardStyle}>
                <div style={{ ...phaseNumberStyle, background: phase.color }}>{phase.number}</div>
                <div style={cardBodyStyle}>
                  <div style={cardHeaderStyle}>
                    <span style={phaseTitleStyle}>{phase.title}</span>
                    <span style={questionStyle}>{phase.question}</span>
                  </div>
                  <p style={descStyle}>{phase.description}</p>
                  <div style={chipRowStyle}>
                    {phase.primitives.map((prim) => {
                      const count = counts[prim] ?? 0
                      return (
                        <span key={prim} style={{ ...chipStyle, borderColor: phase.color }}>
                          {prim}
                          {count > 0 && (
                            <span style={{ ...badgeStyle, background: phase.color }}>{count}</span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Process visualization */}
        {operationalDna && (operationalDna.processes ?? []).length > 0 && (
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Defined Processes</h3>
            {(operationalDna.processes ?? []).map((proc) => (
              <div key={proc.name} style={processCardStyle}>
                <div style={processHeaderStyle}>
                  <span style={processNameStyle}>{proc.name}</span>
                  <span style={processOperatorStyle}>operator: {proc.operator}</span>
                </div>
                {proc.description && <p style={processDescStyle}>{proc.description}</p>}
                <div style={stepsContainerStyle}>
                  {proc.steps.map((step, si) => {
                    const deps = step.depends_on ?? []
                    const isRoot = deps.length === 0
                    const isParallelRoot = isRoot && si > 0 && (proc.steps[si - 1].depends_on ?? []).length === 0
                    const isFanIn = deps.length > 1
                    return (
                      <div key={step.id} style={stepRowStyle}>
                        <div style={stepConnectorAreaStyle}>
                          {isRoot && si === 0 && <span style={stepDotStyle}>&#9679;</span>}
                          {isRoot && si > 0 && isParallelRoot && <span style={parallelMarkStyle}>&#x2225;</span>}
                          {!isRoot && !isFanIn && <span style={arrowStyle}>&#8594;</span>}
                          {isFanIn && <span style={fanInStyle}>&#8594;&#8594;</span>}
                        </div>
                        <div style={stepCardStyle}>
                          <div style={stepIdStyle}>{step.id}</div>
                          <div style={stepTaskStyle}>{step.task}</div>
                          {step.branch && (
                            <div style={branchStyle}>
                              &#9670; {step.branch.when}
                              {step.branch.else && <span style={branchElseStyle}> else: {step.branch.else}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
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
  overflow: 'hidden',
}

const scrollStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: 32,
}

const headerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto 32px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: '-apple-system, sans-serif',
}

const subtitleStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  color: '#94a3b8',
  lineHeight: 1.6,
  fontFamily: '-apple-system, sans-serif',
}

const flowStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
}

const phaseRowStyle: React.CSSProperties = {
  position: 'relative',
}

const connectorStyle: React.CSSProperties = {
  position: 'absolute',
  top: -12,
  left: 23,
  width: 2,
  height: 12,
  background: '#334155',
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  padding: '16px 20px',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  marginBottom: 0,
}

const phaseNumberStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  minWidth: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
  color: '#fff',
  fontFamily: '-apple-system, sans-serif',
}

const cardBodyStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
  marginBottom: 4,
}

const phaseTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: '-apple-system, sans-serif',
}

const questionStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  fontStyle: 'italic',
  fontFamily: '-apple-system, sans-serif',
}

const descStyle: React.CSSProperties = {
  margin: '4px 0 8px',
  fontSize: 12,
  color: '#94a3b8',
  lineHeight: 1.5,
  fontFamily: '-apple-system, sans-serif',
}

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 500,
  color: '#cbd5e1',
  border: '1px solid',
  borderRadius: 4,
  fontFamily: 'ui-monospace, monospace',
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 16,
  padding: '0 4px',
  fontSize: 10,
  fontWeight: 700,
  color: '#fff',
  borderRadius: 8,
}

// ── Process section styles ──────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '40px auto 0',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 16,
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: '-apple-system, sans-serif',
}

const processCardStyle: React.CSSProperties = {
  padding: '16px 20px',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  marginBottom: 12,
}

const processHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
  marginBottom: 4,
}

const processNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#f59e0b',
  fontFamily: 'ui-monospace, monospace',
}

const processOperatorStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  fontFamily: 'ui-monospace, monospace',
}

const processDescStyle: React.CSSProperties = {
  margin: '4px 0 12px',
  fontSize: 12,
  color: '#94a3b8',
  lineHeight: 1.5,
  fontFamily: '-apple-system, sans-serif',
}

const stepsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const stepRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const stepConnectorAreaStyle: React.CSSProperties = {
  width: 24,
  textAlign: 'center',
  color: '#475569',
  fontSize: 14,
  flexShrink: 0,
}

const stepDotStyle: React.CSSProperties = { fontSize: 8, color: '#10b981' }
const parallelMarkStyle: React.CSSProperties = { fontSize: 12, color: '#f59e0b' }
const arrowStyle: React.CSSProperties = { color: '#475569' }
const fanInStyle: React.CSSProperties = { color: '#06b6d4', fontSize: 12 }

const stepCardStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 10px',
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 4,
  minHeight: 28,
  flexWrap: 'wrap',
}

const stepIdStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#8b5cf6',
  fontFamily: 'ui-monospace, monospace',
  minWidth: 80,
}

const stepTaskStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  fontFamily: 'ui-monospace, monospace',
}

const branchStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#f59e0b',
  fontFamily: 'ui-monospace, monospace',
}

const branchElseStyle: React.CSSProperties = {
  color: '#ef4444',
}

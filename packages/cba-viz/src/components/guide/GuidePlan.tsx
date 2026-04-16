import type { OperationalDNA } from '../../loaders/operational-loader.ts'

interface GuidePlanProps {
  dna: OperationalDNA
}

interface Epic {
  key: string
  name: string
  color: string
}

interface Ticket {
  id: string
  title: string
  epic: string
  assignee: string
  startDay: number
  durationDays: number
  dependsOn?: string[]
}

const EPICS: Epic[] = [
  { key: 'INFRA',  name: 'Foundation',       color: '#64748b' },
  { key: 'INTAKE', name: 'Claimant Intake',  color: '#10b981' },
  { key: 'PREP',   name: 'Case Preparation', color: '#8b5cf6' },
  { key: 'CLAIM',  name: 'Claim Resolution', color: '#f59e0b' },
  { key: 'EVID',   name: 'Evidence + Status', color: '#06b6d4' },
  { key: 'ADMIN',  name: 'Firm + Withdrawal', color: '#a855f7' },
  { key: 'QA',     name: 'QA & Launch',       color: '#f43f5e' },
]

const TICKETS: Ticket[] = [
  // Foundation (week 1-2)
  { id: 'INFRA-1', title: 'Postgres + api-cell scaffolding', epic: 'INFRA',  assignee: 'Backend',  startDay: 0,  durationDays: 3 },
  { id: 'INFRA-2', title: 'ui-cell scaffolding (marketing + admin)', epic: 'INFRA', assignee: 'Frontend', startDay: 0, durationDays: 3 },
  { id: 'INFRA-3', title: 'Auth middleware + role config',     epic: 'INFRA',  assignee: 'Backend',  startDay: 3,  durationDays: 2, dependsOn: ['INFRA-1'] },
  { id: 'INFRA-4', title: 'Event bus + signal dispatch setup', epic: 'INFRA',  assignee: 'Backend',  startDay: 3,  durationDays: 3, dependsOn: ['INFRA-1'] },

  // Claimant Intake (week 2-4)
  { id: 'INTAKE-1', title: 'IntakeSubmission.Submit + Qualify', epic: 'INTAKE', assignee: 'Backend', startDay: 5, durationDays: 4, dependsOn: ['INFRA-3'] },
  { id: 'INTAKE-2', title: 'Claimant.Register signal handler',  epic: 'INTAKE', assignee: 'Backend', startDay: 9, durationDays: 2, dependsOn: ['INTAKE-1', 'INFRA-4'] },
  { id: 'INTAKE-3', title: 'Claimant.Assign workflow',          epic: 'INTAKE', assignee: 'Backend', startDay: 11, durationDays: 2, dependsOn: ['INTAKE-2'] },
  { id: 'INTAKE-4', title: 'Public intake form (marketing site)', epic: 'INTAKE', assignee: 'Frontend', startDay: 5, durationDays: 5, dependsOn: ['INFRA-2'] },
  { id: 'INTAKE-5', title: 'Staff review queue UI',             epic: 'INTAKE', assignee: 'Frontend', startDay: 10, durationDays: 4, dependsOn: ['INTAKE-4'] },

  // Case Preparation (week 4-7)
  { id: 'PREP-1', title: 'Property.Assess capability',   epic: 'PREP',  assignee: 'Backend',  startDay: 13, durationDays: 3, dependsOn: ['INTAKE-3'] },
  { id: 'PREP-2', title: 'Case preparation dashboard',   epic: 'PREP',  assignee: 'Frontend', startDay: 14, durationDays: 5, dependsOn: ['INTAKE-5'] },
  { id: 'PREP-3', title: 'Property assessment UI',       epic: 'PREP',  assignee: 'Frontend', startDay: 16, durationDays: 3, dependsOn: ['PREP-1'] },

  // Evidence + Status (parallel with prep)
  { id: 'EVID-1', title: 'Evidence.Upload + Verify',     epic: 'EVID',  assignee: 'Backend',  startDay: 13, durationDays: 4, dependsOn: ['INTAKE-3'] },
  { id: 'EVID-2', title: 'CaseStatus.Advance milestones', epic: 'EVID', assignee: 'Backend',  startDay: 13, durationDays: 2, dependsOn: ['INTAKE-3'] },
  { id: 'EVID-3', title: 'Evidence management UI',       epic: 'EVID',  assignee: 'Frontend', startDay: 17, durationDays: 5, dependsOn: ['EVID-1'] },

  // Claim Resolution (week 7-9)
  { id: 'CLAIM-1', title: 'Claim.File + Review + UpdateStatus', epic: 'CLAIM', assignee: 'Backend',  startDay: 19, durationDays: 5, dependsOn: ['PREP-1', 'EVID-1'] },
  { id: 'CLAIM-2', title: 'Claim review UI',                    epic: 'CLAIM', assignee: 'Frontend', startDay: 22, durationDays: 5, dependsOn: ['PREP-2', 'CLAIM-1'] },
  { id: 'CLAIM-3', title: 'Resolution workflow + branching',    epic: 'CLAIM', assignee: 'Backend',  startDay: 24, durationDays: 3, dependsOn: ['CLAIM-1'] },

  // Admin + Withdrawal (week 9-10)
  { id: 'ADMIN-1', title: 'Firm.Onboard + Attorney.Assign',  epic: 'ADMIN', assignee: 'Backend',  startDay: 27, durationDays: 3, dependsOn: ['INFRA-3'] },
  { id: 'ADMIN-2', title: 'Firm/Attorney admin UI',          epic: 'ADMIN', assignee: 'Frontend', startDay: 27, durationDays: 4, dependsOn: ['ADMIN-1'] },
  { id: 'ADMIN-3', title: 'ClientWithdrawal process (API+UI)', epic: 'ADMIN', assignee: 'Fullstack', startDay: 30, durationDays: 4, dependsOn: ['CLAIM-3'] },

  // QA & Launch (week 10-11)
  { id: 'QA-1', title: 'End-to-end test harness',          epic: 'QA', assignee: 'QA',      startDay: 32, durationDays: 5, dependsOn: ['CLAIM-3', 'ADMIN-3'] },
  { id: 'QA-2', title: 'SOP documentation publishing',     epic: 'QA', assignee: 'TechWriter', startDay: 34, durationDays: 4 },
  { id: 'QA-3', title: 'Production deployment (AWS)',      epic: 'QA', assignee: 'DevOps',  startDay: 38, durationDays: 3, dependsOn: ['QA-1'] },
]

const TOTAL_DAYS = 42
const DAY_WIDTH = 14 // px per day
const ROW_HEIGHT = 28
const LABEL_COL_WIDTH = 280

export function GuidePlan({ dna }: GuidePlanProps) {
  void dna // reserved for future DNA-derived ticket generation

  const groupedByEpic = EPICS.map((epic) => ({
    epic,
    tickets: TICKETS.filter((t) => t.epic === epic.key),
  }))

  // Sprint boundaries every 10 days (2-week sprints)
  const sprintBoundaries = [10, 20, 30, 40]

  return (
    <div style={containerStyle}>
      <div style={introStyle}>
        Estimated implementation plan — {TICKETS.length} tickets across {EPICS.length} epics,
        roughly {Math.ceil(TOTAL_DAYS / 5)} working weeks. Bars show start day + duration;
        dotted lines mark 2-week sprint boundaries.
      </div>

      {/* Timeline header */}
      <div style={timelineWrapStyle}>
        <div style={headerRowStyle}>
          <div style={{ ...labelCellStyle, fontWeight: 600, color: '#94a3b8' }}>Ticket</div>
          <div style={timelineHeaderStyle}>
            {Array.from({ length: Math.ceil(TOTAL_DAYS / 5) + 1 }, (_, i) => (
              <div
                key={i}
                style={{
                  ...weekMarkStyle,
                  left: i * 5 * DAY_WIDTH,
                }}
              >
                W{i + 1}
              </div>
            ))}
            {sprintBoundaries.map((day) => (
              <div
                key={day}
                style={{
                  ...sprintLineStyle,
                  left: day * DAY_WIDTH,
                }}
              />
            ))}
          </div>
        </div>

        {/* Epic rows */}
        {groupedByEpic.map(({ epic, tickets }) => (
          <div key={epic.key}>
            <div style={epicHeaderStyle}>
              <div style={{ ...labelCellStyle, color: epic.color, fontWeight: 700 }}>
                {epic.name}
              </div>
              <div style={epicHeaderTrackStyle} />
            </div>
            {tickets.map((ticket) => (
              <div key={ticket.id} style={ticketRowStyle}>
                <div style={labelCellStyle}>
                  <span style={ticketIdStyle}>{ticket.id}</span>
                  <span style={ticketTitleStyle}>{ticket.title}</span>
                  <span style={ticketAssigneeStyle}>{ticket.assignee}</span>
                </div>
                <div style={trackStyle}>
                  {sprintBoundaries.map((day) => (
                    <div
                      key={day}
                      style={{
                        ...sprintLineStyle,
                        left: day * DAY_WIDTH,
                      }}
                    />
                  ))}
                  <div
                    style={{
                      ...barStyle,
                      left: ticket.startDay * DAY_WIDTH,
                      width: ticket.durationDays * DAY_WIDTH - 2,
                      background: epic.color,
                    }}
                    title={`${ticket.id}: ${ticket.title}\nDays ${ticket.startDay}–${ticket.startDay + ticket.durationDays}${ticket.dependsOn ? `\nDepends on: ${ticket.dependsOn.join(', ')}` : ''}`}
                  >
                    {ticket.durationDays >= 3 && (
                      <span style={barLabelStyle}>{ticket.durationDays}d</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={legendStyle}>
        {EPICS.map((epic) => (
          <div key={epic.key} style={legendItemStyle}>
            <div style={{ ...legendSwatchStyle, background: epic.color }} />
            <span style={legendLabelStyle}>{epic.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const introStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
  lineHeight: 1.6,
  fontFamily: '-apple-system, sans-serif',
  padding: '8px 12px',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
}

const timelineWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #334155',
  position: 'sticky',
  top: 0,
  background: '#1e293b',
  zIndex: 2,
  minHeight: ROW_HEIGHT,
}

const labelCellStyle: React.CSSProperties = {
  width: LABEL_COL_WIDTH,
  minWidth: LABEL_COL_WIDTH,
  padding: '6px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderRight: '1px solid #334155',
  fontSize: 11,
  fontFamily: '-apple-system, sans-serif',
  overflow: 'hidden',
}

const timelineHeaderStyle: React.CSSProperties = {
  position: 'relative',
  width: TOTAL_DAYS * DAY_WIDTH,
  height: ROW_HEIGHT,
}

const weekMarkStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  fontSize: 10,
  fontWeight: 600,
  color: '#64748b',
  fontFamily: 'ui-monospace, monospace',
}

const sprintLineStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 1,
  borderLeft: '1px dashed #475569',
  zIndex: 1,
}

const epicHeaderStyle: React.CSSProperties = {
  display: 'flex',
  background: '#0f172a',
  borderBottom: '1px solid #334155',
  borderTop: '1px solid #334155',
  minHeight: ROW_HEIGHT - 4,
}

const epicHeaderTrackStyle: React.CSSProperties = {
  position: 'relative',
  width: TOTAL_DAYS * DAY_WIDTH,
}

const ticketRowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #1e293b',
  minHeight: ROW_HEIGHT,
}

const ticketIdStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#94a3b8',
  fontFamily: 'ui-monospace, monospace',
  minWidth: 60,
}

const ticketTitleStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: '#cbd5e1',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const ticketAssigneeStyle: React.CSSProperties = {
  fontSize: 9,
  color: '#64748b',
  fontFamily: 'ui-monospace, monospace',
  padding: '1px 5px',
  background: '#0f172a',
  borderRadius: 2,
}

const trackStyle: React.CSSProperties = {
  position: 'relative',
  width: TOTAL_DAYS * DAY_WIDTH,
  height: ROW_HEIGHT,
}

const barStyle: React.CSSProperties = {
  position: 'absolute',
  top: 5,
  height: ROW_HEIGHT - 10,
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 600,
  color: '#0f172a',
  fontFamily: 'ui-monospace, monospace',
  zIndex: 2,
  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
}

const barLabelStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}

const legendStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  padding: '8px 0',
}

const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const legendSwatchStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 2,
}

const legendLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  fontFamily: '-apple-system, sans-serif',
}

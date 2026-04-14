import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ArchitectureDNA } from '../loaders/dna-loader.ts'

/**
 * Live log panel for Run > Logs.
 *
 * First cut of Phase 5c.6. The pattern established here (polling +
 * virtualized list + per-cell color coding) is the template for
 * Metrics (5c.7) and Access (5c.8).
 *
 * Data flow:
 *   - Poll /api/logs/:domain every 2s (AbortController cleanup on
 *     unmount + any in-flight fetch is aborted when a new one starts).
 *   - Server returns `{ lines: [{ ts, cell, text }], warning? }`.
 *     `warning` surfaces non-fatal adapter state (e.g. terraform/aws
 *     CloudWatch-not-wired-yet) without failing the request.
 *   - The visible window is virtualized by row index with a fixed row
 *     height — we render `[start..end+buffer]` and reserve total height
 *     via a spacer div. No external virtualization dep.
 *
 * Follow mode: if the user is parked within FOLLOW_THRESHOLD_PX of the
 * bottom, new lines auto-scroll. As soon as they scroll away, we pause
 * and show a "jump to latest" chip.
 */

interface LogsPanelProps {
  domain: string
  adapter: string
  env: string
  technicalDna: ArchitectureDNA | null
}

interface LogLine {
  ts: string
  cell: string
  text: string
}

interface LogsResponse {
  lines: LogLine[]
  warning?: string
}

// Fixed row height — needs to match the actual CSS to avoid drift.
const ROW_HEIGHT = 18
const ROW_BUFFER = 10
const POLL_INTERVAL_MS = 2000
const FOLLOW_THRESHOLD_PX = 40
const SINCE_SECONDS = 60

export function LogsPanel({ domain, adapter, env, technicalDna }: LogsPanelProps) {
  const [lines, setLines] = useState<LogLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [cellFilter, setCellFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Scroll virtualization state
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  // Follow-mode state. `following` means auto-scroll to bottom on new
  // lines. `userScrolledAway` tracks whether the user has manually
  // scrolled up; resetting it when they hit bottom again re-enables follow.
  const [following, setFollowing] = useState(true)
  const suppressScrollEventRef = useRef(false)

  // ── Cell filter options ──────────────────────────────────────────────
  //
  // Collect unique cell node ids across all technical views. The spec
  // says "from the deployment's dna.views[].nodes.filter(n => n.type ===
  // 'cell')" — we union across views so switching a view doesn't drop
  // the dropdown options.
  const cellOptions = useMemo(() => {
    if (!technicalDna) return [] as string[]
    const seen = new Set<string>()
    for (const v of technicalDna.views ?? []) {
      for (const n of v.nodes ?? []) {
        if (n.type === 'cell') seen.add(n.name)
      }
    }
    return Array.from(seen).sort()
  }, [technicalDna])

  // ── Polling loop ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let currentAbort: AbortController | null = null
    let timer: number | null = null

    const fetchOnce = async () => {
      // Abort any still-in-flight request before issuing a new one so
      // slow responses don't overwrite fresh ones out of order.
      if (currentAbort) currentAbort.abort()
      const ac = new AbortController()
      currentAbort = ac

      const params = new URLSearchParams()
      params.set('adapter', adapter)
      params.set('env', env)
      params.set('since', String(SINCE_SECONDS))
      if (cellFilter) params.set('cell', cellFilter)

      try {
        const res = await fetch(
          `/api/logs/${encodeURIComponent(domain)}?${params.toString()}`,
          { signal: ac.signal },
        )
        if (cancelled) return
        if (!res.ok) {
          setError(`HTTP ${res.status} ${res.statusText}`)
          setLoading(false)
          return
        }
        const data = (await res.json()) as LogsResponse
        if (cancelled) return
        setLines(Array.isArray(data.lines) ? data.lines : [])
        setWarning(data.warning ?? null)
        setError(null)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        // AbortError is expected when we replace the request; swallow it.
        if ((err as { name?: string }).name === 'AbortError') return
        setError(String((err as Error).message ?? err))
        setLoading(false)
      }
    }

    fetchOnce()
    timer = window.setInterval(fetchOnce, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer !== null) window.clearInterval(timer)
      if (currentAbort) currentAbort.abort()
    }
  }, [domain, adapter, env, cellFilter])

  // ── Measure the scroll viewport ──────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight)
    })
    ro.observe(el)
    setViewportHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // ── Auto-follow on new lines ─────────────────────────────────────────
  //
  // When new lines come in AND we're in follow mode, pin the scroll to
  // the bottom. We suppress the scroll event fired by our own setter so
  // it doesn't get interpreted as a manual scroll-away.
  useEffect(() => {
    if (!following) return
    const el = scrollRef.current
    if (!el) return
    suppressScrollEventRef.current = true
    el.scrollTop = el.scrollHeight
  }, [lines, following])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (suppressScrollEventRef.current) {
      suppressScrollEventRef.current = false
      setScrollTop(el.scrollTop)
      return
    }
    setScrollTop(el.scrollTop)
    // If the user is within FOLLOW_THRESHOLD_PX of the bottom, resume
    // follow mode. Otherwise pause it.
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop
    if (distanceFromBottom <= FOLLOW_THRESHOLD_PX) {
      if (!following) setFollowing(true)
    } else {
      if (following) setFollowing(false)
    }
  }, [following])

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    suppressScrollEventRef.current = true
    el.scrollTop = el.scrollHeight
    setFollowing(true)
  }, [])

  // ── Virtualization math ──────────────────────────────────────────────
  const totalHeight = lines.length * ROW_HEIGHT
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_BUFFER)
  const endIdx = Math.min(
    lines.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + ROW_BUFFER,
  )
  const visible = lines.slice(startIdx, endIdx)
  const offsetY = startIdx * ROW_HEIGHT

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <div style={toolbarStyle}>
        <label style={labelStyle}>
          Cell
          <select
            value={cellFilter}
            onChange={(e) => setCellFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All cells</option>
            {cellOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <div style={spacerStyle} />
        <div style={statusStyle}>
          {loading ? 'Loading…' : `${lines.length} line${lines.length === 1 ? '' : 's'}`}
          {following ? <span style={followBadgeStyle}>live</span> : null}
        </div>
      </div>

      {warning ? (
        <div style={warningStyle}>{warning}</div>
      ) : null}

      {error ? (
        <div style={errorStyle}>Error: {error}</div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={scrollContainerStyle}
      >
        {lines.length === 0 && !loading && !error ? (
          <div style={emptyStyle}>No logs yet</div>
        ) : (
          <div style={{ position: 'relative', height: totalHeight }}>
            <div
              style={{
                position: 'absolute',
                top: offsetY,
                left: 0,
                right: 0,
              }}
            >
              {visible.map((line, i) => (
                <LogRow key={startIdx + i} line={line} />
              ))}
            </div>
          </div>
        )}
      </div>

      {!following && lines.length > 0 ? (
        <button type="button" onClick={jumpToLatest} style={jumpChipStyle}>
          Jump to latest ↓
        </button>
      ) : null}
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────

function LogRow({ line }: { line: LogLine }) {
  const color = colorForCell(line.cell)
  return (
    <div style={rowStyle}>
      <span style={{ ...cellTagStyle, color, borderColor: color }}>{line.cell || '?'}</span>
      <span style={lineTextStyle}>{line.text}</span>
    </div>
  )
}

/**
 * Stable color for a cell name. Hashes the name to a hue and returns a
 * desaturated slate-friendly HSL that reads on the #0f172a background.
 * Same cell always maps to the same color across mounts.
 */
function colorForCell(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 55%, 65%)`
}

// ── Styles ─────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#0f172a',
  color: '#e2e8f0',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  position: 'relative',
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  background: '#1e293b',
  borderBottom: '1px solid #334155',
  fontSize: 12,
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#94a3b8',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const selectStyle: React.CSSProperties = {
  background: '#0f172a',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 3,
  padding: '3px 6px',
  fontSize: 12,
  fontFamily: 'inherit',
}

const spacerStyle: React.CSSProperties = {
  flex: 1,
}

const statusStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const followBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  background: 'rgba(34, 197, 94, 0.15)',
  border: '1px solid #22c55e',
  borderRadius: 3,
  color: '#4ade80',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const warningStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'rgba(234, 179, 8, 0.1)',
  borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
  color: '#facc15',
  fontSize: 11,
}

const errorStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'rgba(239, 68, 68, 0.1)',
  borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#f87171',
  fontSize: 11,
}

const scrollContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  // `contain: strict` lets the browser skip layout/paint of off-screen
  // sub-trees — important when the spacer div is tall (thousands of
  // log lines). Pairs with the absolute-positioned inner window.
  contain: 'strict',
}

const emptyStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748b',
  fontSize: 13,
}

const rowStyle: React.CSSProperties = {
  height: ROW_HEIGHT,
  lineHeight: `${ROW_HEIGHT}px`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 12px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontSize: 12,
}

const cellTagStyle: React.CSSProperties = {
  display: 'inline-block',
  flexShrink: 0,
  padding: '0 6px',
  border: '1px solid',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'lowercase',
  // Reserve a consistent width so the text column lines up vertically
  // regardless of cell name length.
  minWidth: 80,
  textAlign: 'center',
  height: 14,
  lineHeight: '12px',
}

const lineTextStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: '#e2e8f0',
}

const jumpChipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  padding: '6px 12px',
  background: '#3b82f6',
  color: '#f8fafc',
  border: '1px solid #2563eb',
  borderRadius: 999,
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
}

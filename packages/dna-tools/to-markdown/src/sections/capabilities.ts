import { DnaInput, Rule, RuleAllow } from '../types'
import { hashes } from '../util'

export function renderCapabilities(dna: DnaInput, h: number): string | null {
  const op = dna.operational
  if (!op?.capabilities?.length) return null

  const causesByCap = groupBy(op.causes ?? [], (c) => c.capability)
  const rulesByCap = groupBy(op.rules ?? [], (r) => r.capability)
  const outcomesByCap = groupBy(op.outcomes ?? [], (o) => o.capability)
  const signalsByCap = groupBy(op.signals ?? [], (s) => s.capability)

  const lines: string[] = [`${hashes(h)} Capabilities`]

  for (const cap of op.capabilities) {
    lines.push('', `${hashes(h + 1)} ${cap.name}`)
    if (cap.description) lines.push('', cap.description)

    const causes = causesByCap.get(cap.name) ?? []
    if (causes.length) {
      lines.push('', '**Triggered by:**')
      for (const c of causes) {
        const signal = c.signal ? ` — signal \`${c.signal}\`` : ''
        const desc = c.description ? ` (${c.description})` : ''
        lines.push(`- ${c.source}${signal}${desc}`)
      }
    }

    const rules = rulesByCap.get(cap.name) ?? []
    if (rules.length) {
      lines.push('', '**Rules:**')
      for (const r of rules) lines.push(`- ${renderRule(r)}`)
    }

    const outcomes = outcomesByCap.get(cap.name) ?? []
    if (outcomes.length) {
      lines.push('', '**Outcomes:**')
      for (const o of outcomes) {
        if (o.description) lines.push(`- ${o.description}`)
        for (const c of o.changes ?? []) {
          const set = c.set === undefined ? '' : ` → \`${JSON.stringify(c.set)}\``
          lines.push(`- Sets \`${c.attribute}\`${set}`)
        }
        for (const next of o.initiate ?? []) lines.push(`- Initiates \`${next}\``)
        for (const sig of o.emits ?? []) lines.push(`- Emits \`${sig}\``)
      }
    }

    const signals = signalsByCap.get(cap.name) ?? []
    if (signals.length) {
      lines.push('', '**Signals published:**')
      for (const s of signals) {
        lines.push(`- \`${s.name}\`${s.description ? ` — ${s.description}` : ''}`)
        if (s.payload?.length) {
          for (const field of s.payload) {
            const req = field.required ? ' (required)' : ''
            lines.push(`  - \`${field.name}\`: ${field.type}${req}`)
          }
        }
      }
    }
  }

  return lines.join('\n')
}

function renderRule(r: Rule): string {
  if (r.type === 'access') return `*Access:* ${renderAllow(r.allow ?? [])}`
  if (r.type === 'condition') return `*Condition:* ${r.condition ?? r.description ?? '—'}`
  return r.description ?? r.name ?? '—'
}

function renderAllow(allow: RuleAllow[]): string {
  if (!allow.length) return '—'
  return allow
    .map((a) => {
      const parts: string[] = []
      if (a.role) parts.push(`role \`${a.role}\``)
      if (a.ownership) parts.push(`ownership \`${a.ownership}\``)
      if (a.flags?.length) parts.push(`flags \`[${a.flags.join(', ')}]\``)
      return parts.join(' + ') || '—'
    })
    .join(' OR ')
}

function groupBy<T>(arr: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const x of arr) {
    const k = key(x)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(x)
  }
  return out
}

import { DnaInput, Task } from '../types'
import { hashes } from '../util'

export function renderSops(dna: DnaInput, h: number): string | null {
  const op = dna.operational
  if (!op?.processes?.length) return null

  const tasksByName = new Map<string, Task>((op.tasks ?? []).map((t) => [t.name, t]))

  const lines: string[] = [`${hashes(h)} SOPs`]

  for (const proc of op.processes) {
    lines.push('', `${hashes(h + 1)} ${proc.name}`)
    if (proc.description) lines.push('', proc.description)
    if (proc.operator) lines.push('', `**Operator:** \`${proc.operator}\``)
    if (proc.emits?.length) {
      lines.push('', `**Emits:** ${proc.emits.map((s) => `\`${s}\``).join(', ')}`)
    }

    const steps = proc.steps ?? []
    if (steps.length) {
      lines.push('')
      steps.forEach((step, i) => {
        const task = tasksByName.get(step.task)
        const actor = task?.position ?? '—'
        const cap = task?.capability ?? step.task
        const branch = step.branch?.else
          ? ' (else)'
          : step.branch?.when
            ? ` (when: ${step.branch.when})`
            : ''
        const deps = step.depends_on?.length
          ? ` — after: ${step.depends_on.map((d) => `\`${d}\``).join(', ')}`
          : ''
        lines.push(
          `${i + 1}. **${step.id}** — \`${actor}\` does \`${cap}\`${branch}${deps}`,
        )
        if (task?.description) lines.push(`   ${task.description}`)
      })
    }
  }

  return lines.join('\n')
}

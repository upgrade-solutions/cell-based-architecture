import { DnaInput, ProcessStep } from '../types'
import { hashes } from '../util'

export function renderProcessFlow(dna: DnaInput, h: number): string | null {
  const op = dna.operational
  if (!op?.processes?.length) return null

  const lines: string[] = [`${hashes(h)} Process Flows`]

  for (const proc of op.processes) {
    lines.push('', `${hashes(h + 1)} ${proc.name}`)
    const steps = proc.steps ?? []
    if (steps.length) {
      lines.push('', '```', ...renderSteps(steps), '```')
    }
  }

  return lines.join('\n')
}

/**
 * Outline-style ASCII rendering of a process DAG.
 *
 * Each step prints on one line with a tree-branch prefix, its id + task,
 * any branch marker, and arrow-back references to its depends_on. Concurrent
 * or converging arms render correctly because each step declares its own
 * dependencies — no layout algebra needed.
 */
function renderSteps(steps: ProcessStep[]): string[] {
  return steps.map((step, i) => {
    const last = i === steps.length - 1
    const prefix = last ? '└── ' : '├── '
    const branch = step.branch?.else
      ? ' [else]'
      : step.branch?.when
        ? ` [when: ${step.branch.when}]`
        : ''
    const deps = step.depends_on?.length ? ` ← ${step.depends_on.join(', ')}` : ''
    return `${prefix}${step.id}: ${step.task}${branch}${deps}`
  })
}

import { DnaInput } from './types'
import { renderSummary } from './sections/summary'
import { renderDomainModel } from './sections/domain-model'
import { renderCapabilities } from './sections/capabilities'
import { renderSops } from './sections/sops'
import { renderProcessFlow } from './sections/process-flow'
import { hashes } from './util'

export type Section =
  | 'summary'
  | 'domain-model'
  | 'capabilities'
  | 'sops'
  | 'process-flow'

export const DEFAULT_SECTIONS: readonly Section[] = [
  'summary',
  'domain-model',
  'capabilities',
  'sops',
  'process-flow',
]

export interface RenderOptions {
  /** Which sections to include, in the given order. Defaults to DEFAULT_SECTIONS. */
  sections?: readonly Section[]
  /** Document title. Defaults to the operational domain's `path` or `name`. */
  title?: string
  /** Starting heading level for the document title (1 or 2). Section headings nest below. */
  headingLevel?: 1 | 2
}

export function render(dna: DnaInput, options: RenderOptions = {}): string {
  const sections = options.sections ?? DEFAULT_SECTIONS
  const level = options.headingLevel ?? 1
  const title = options.title ?? inferTitle(dna)

  const parts: string[] = []

  if (title) parts.push(`${hashes(level)} ${title}`)

  const intro = dna.operational?.domain.description
  if (intro) parts.push(intro)

  for (const section of sections) {
    const rendered = renderSection(section, dna, level + 1)
    if (rendered) parts.push(rendered)
  }

  return parts.length ? parts.join('\n\n') + '\n' : ''
}

function renderSection(
  section: Section,
  dna: DnaInput,
  h: number,
): string | null {
  switch (section) {
    case 'summary':
      return renderSummary(dna, h)
    case 'domain-model':
      return renderDomainModel(dna, h)
    case 'capabilities':
      return renderCapabilities(dna, h)
    case 'sops':
      return renderSops(dna, h)
    case 'process-flow':
      return renderProcessFlow(dna, h)
  }
}

function inferTitle(dna: DnaInput): string | undefined {
  const op = dna.operational
  if (!op) return undefined
  return op.domain.path ?? op.domain.name
}

export * from './types'

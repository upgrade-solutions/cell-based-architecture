/**
 * Architecture DNA loader.
 *
 * In dev mode we import the JSON files directly via Vite's ?url / ?raw
 * transforms. For a production build you'd swap this for an API fetch.
 */

export type NodeStatus = 'proposed' | 'planned' | 'deployed'

export interface ArchNode {
  id: string
  name: string
  type: 'cell' | 'construct' | 'provider' | 'domain' | 'noun' | 'external' | 'custom'
  status?: NodeStatus
  source?: string
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  description?: string
  metadata?: Record<string, unknown>
}

export interface ArchConnection {
  id: string
  source: string
  target: string
  type: 'depends-on' | 'data-flow' | 'communicates-with' | 'publishes-to'
  label?: string
  vertices?: Array<{ x: number; y: number }>
  metadata?: Record<string, unknown>
}

export interface ArchZone {
  id: string
  name: string
  type: 'tier' | 'boundary' | 'environment' | 'domain'
  nodes: string[]
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  description?: string
  metadata?: Record<string, unknown>
}

export interface ArchView {
  name: string
  description?: string
  layout?: { type: string; direction?: string }
  nodes: ArchNode[]
  connections?: ArchConnection[]
  zones?: ArchZone[]
}

export interface ArchitectureDNA {
  views: ArchView[]
}

/**
 * Load architecture DNA from a JSON object (passed inline or fetched).
 */
export function parseArchitectureDNA(json: unknown): ArchitectureDNA {
  const data = json as ArchitectureDNA
  if (!data.views || !Array.isArray(data.views)) {
    throw new Error('Invalid architecture DNA: missing "views" array')
  }
  return data
}

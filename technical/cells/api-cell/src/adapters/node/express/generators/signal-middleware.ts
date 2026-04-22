/**
 * Generates Express middleware that automatically emits DNA Signals
 * after handler responses. Uses amqplib to publish to RabbitMQ.
 *
 * Per-route: resolves the capability from the endpoint, checks if the
 * Outcome has `emits`, and if so wraps res.json to capture the entity
 * and publish each signal with typed payload fields.
 *
 * Signal dispatch (Pattern A — HTTP push): after publishing to the event
 * bus, the middleware also HTTP POSTs each signal to configured subscriber
 * API URLs. Subscriber URLs come from `dna/signal-dispatch.json`, which
 * is written from the cell's Technical DNA `signal_dispatch` adapter config.
 */
export function generateSignalMiddleware(engine?: string): string {
  if (engine === 'eventbridge') return generateEventBridgeVariant()
  return generateRabbitMQVariant()
}

function generateRabbitMQVariant(): string {
  return `import * as fs from 'fs'
import * as path from 'path'
import { Request, Response, NextFunction } from 'express'

const amqp = require('amqplib')

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || ''
const EXCHANGE = 'signals'

// Startup-race tolerance: docker-compose healthchecks (rabbitmq-diagnostics
// ping) return healthy before AMQP port 5672 is actually accepting
// connections, so a one-shot connect at boot will get ECONNREFUSED. Retry
// with exponential backoff, capped at 10s per attempt. Total budget across
// MAX_RETRIES attempts is ~50s, which covers cold-starting the broker.
const MAX_RETRIES = 10
const INITIAL_RETRY_DELAY_MS = 500
const MAX_RETRY_DELAY_MS = 10000

// After a successful connection drops at runtime (broker restart, network
// blip), wait this long before reconnecting. Keeps the reconnect loop from
// thrashing if the broker is genuinely down.
const RECONNECT_DELAY_MS = 2000

let connection: any = null
let channel: any = null
let shuttingDown = false

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function connectEventBus(): Promise<void> {
  if (!EVENT_BUS_URL) {
    console.log('[event-bus] EVENT_BUS_URL not set — signal emission disabled')
    return
  }
  let delay = INITIAL_RETRY_DELAY_MS
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(\`[event-bus] Connecting to \${EVENT_BUS_URL} (attempt \${attempt}/\${MAX_RETRIES})...\`)
      connection = await amqp.connect(EVENT_BUS_URL)
      channel = await connection.createChannel()
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
      // Runtime auto-reconnect: if the connection closes unexpectedly (broker
      // restart, network blip), schedule a fresh connectEventBus() so signals
      // resume publishing once the broker is back. disconnectEventBus()
      // flips shuttingDown first so cleanup doesn't race the reconnect.
      connection.on('error', (err: any) => {
        console.error(\`[event-bus] Connection error: \${err.message}\`)
      })
      connection.on('close', () => {
        connection = null
        channel = null
        if (shuttingDown) return
        console.warn(\`[event-bus] Connection closed — reconnecting in \${RECONNECT_DELAY_MS}ms\`)
        setTimeout(() => { connectEventBus().catch(() => {}) }, RECONNECT_DELAY_MS)
      })
      console.log('[event-bus] Connected.')
      return
    } catch (err: any) {
      const isLast = attempt === MAX_RETRIES
      if (isLast) {
        console.error(\`[event-bus] Connect attempt \${attempt} failed: \${err.message} — giving up, signals will be skipped\`)
        return
      }
      console.warn(\`[event-bus] Connect attempt \${attempt} failed: \${err.message} — retrying in \${delay}ms\`)
      await sleep(delay)
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
    }
  }
}

export async function disconnectEventBus(): Promise<void> {
  shuttingDown = true
  if (channel) { await channel.close().catch(() => {}); channel = null }
  if (connection) { await connection.close().catch(() => {}); connection = null }
  console.log('[event-bus] Disconnected.')
}

// ── Signal dispatch config (Pattern A — HTTP push) ──────────────────────────
// Loaded from Technical DNA via dna/signal-dispatch.json at startup.
// Maps signal names to arrays of subscriber base URLs.

const DISPATCH_CONFIG_PATH = path.resolve(__dirname, '../dna/signal-dispatch.json')
let dispatchConfig: Record<string, string[]> = {}
try {
  if (fs.existsSync(DISPATCH_CONFIG_PATH)) {
    dispatchConfig = JSON.parse(fs.readFileSync(DISPATCH_CONFIG_PATH, 'utf-8'))
    const total = Object.values(dispatchConfig).reduce((n, urls) => n + urls.length, 0)
    if (total > 0) {
      console.log(\`[signal-dispatch] Loaded \${total} subscriber URL(s) for \${Object.keys(dispatchConfig).length} signal(s)\`)
    }
  }
} catch (err: any) {
  console.warn(\`[signal-dispatch] Failed to load dispatch config: \${err.message}\`)
}

function publishSignal(signalName: string, capability: string, payload: Record<string, any>): void {
  if (!channel) return
  const message = JSON.stringify({
    signal: signalName,
    capability,
    payload,
    timestamp: new Date().toISOString(),
  })
  channel.publish(EXCHANGE, signalName, Buffer.from(message), { persistent: true })
  console.log(\`[event-bus] Published \${signalName}\`)
}

function dispatchSignalHttp(signalName: string, capability: string, payload: Record<string, any>): void {
  const urls = dispatchConfig[signalName] ?? []
  if (!urls.length) return
  const body = JSON.stringify({
    signal: signalName,
    capability,
    payload,
    timestamp: new Date().toISOString(),
  })
  for (const baseUrl of urls) {
    const url = \`\${baseUrl.replace(/\\/$/, '')}/_signals/\${signalName}\`
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then(res => {
        if (res.ok) console.log(\`[signal-dispatch] Dispatched \${signalName} → \${url}\`)
        else console.warn(\`[signal-dispatch] \${url} responded \${res.status}\`)
      })
      .catch(err => console.error(\`[signal-dispatch] Failed: \${url} — \${err.message}\`))
  }
}

/**
 * Creates per-route signal middleware. Resolves the capability from the
 * endpoint, checks if the matching Outcome has \\\`emits\\\`, and if so
 * intercepts res.json() to capture the response entity and publish
 * each declared signal.
 *
 * If no signals are declared for this route, returns a pass-through.
 */
export function createSignalMiddleware(endpoint: any, api: any, operational: any) {
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const outcome = operational.outcomes?.find((o: any) => o.capability === capability)
  const emits = outcome?.emits as string[] | undefined

  // No signals for this route — zero-overhead pass-through
  if (!emits?.length) {
    return (_req: Request, _res: Response, next: NextFunction) => next()
  }

  const signals = operational.signals ?? []

  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res)

    res.json = function (data: any) {
      // Only emit on success responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const signalName of emits!) {
          const signalDef = signals.find((s: any) => s.name === signalName)
          if (!signalDef) continue

          // Build typed payload from entity using signal's payload field definitions
          const payload: Record<string, any> = {}
          for (const field of signalDef.payload) {
            if (data[field.name] !== undefined) {
              payload[field.name] = data[field.name]
            }
          }

          // Publish to event bus (fire and forget)
          publishSignal(signalName, capability, payload)

          // Dispatch to subscriber APIs via HTTP (Pattern A)
          dispatchSignalHttp(signalName, capability, payload)
        }
      }
      return originalJson(data)
    }

    next()
  }
}
`
}

function generateEventBridgeVariant(): string {
  return `import * as fs from 'fs'
import * as path from 'path'
import { Request, Response, NextFunction } from 'express'
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default'
const EVENT_BUS_SOURCE = process.env.EVENT_BUS_SOURCE || 'app'

let ebClient: EventBridgeClient | null = null

export async function connectEventBus(): Promise<void> {
  if (!EVENT_BUS_NAME || EVENT_BUS_NAME === 'default') {
    console.log('[event-bus] EVENT_BUS_NAME not set — signal emission disabled')
    return
  }
  try {
    console.log(\`[event-bus] Connecting to EventBridge bus "\${EVENT_BUS_NAME}"...\`)
    ebClient = new EventBridgeClient({})
    console.log('[event-bus] Connected.')
  } catch (err: any) {
    console.error(\`[event-bus] Connection failed: \${err.message} — signals will be skipped\`)
  }
}

export async function disconnectEventBus(): Promise<void> {
  if (ebClient) { ebClient.destroy(); ebClient = null }
  console.log('[event-bus] Disconnected.')
}

// ── Signal dispatch config (Pattern A — HTTP push) ──────────────────────────
const DISPATCH_CONFIG_PATH = path.resolve(__dirname, '../dna/signal-dispatch.json')
let dispatchConfig: Record<string, string[]> = {}
try {
  if (fs.existsSync(DISPATCH_CONFIG_PATH)) {
    dispatchConfig = JSON.parse(fs.readFileSync(DISPATCH_CONFIG_PATH, 'utf-8'))
    const total = Object.values(dispatchConfig).reduce((n, urls) => n + urls.length, 0)
    if (total > 0) {
      console.log(\`[signal-dispatch] Loaded \${total} subscriber URL(s) for \${Object.keys(dispatchConfig).length} signal(s)\`)
    }
  }
} catch (err: any) {
  console.warn(\`[signal-dispatch] Failed to load dispatch config: \${err.message}\`)
}

function publishSignal(signalName: string, capability: string, payload: Record<string, any>): void {
  if (!ebClient) return
  const detail = JSON.stringify({
    signal: signalName,
    capability,
    payload,
    timestamp: new Date().toISOString(),
  })
  ebClient.send(new PutEventsCommand({
    Entries: [{
      Source: EVENT_BUS_SOURCE,
      DetailType: signalName,
      Detail: detail,
      EventBusName: EVENT_BUS_NAME,
    }],
  }))
    .then(() => console.log(\`[event-bus] Published \${signalName}\`))
    .catch((err: any) => console.error(\`[event-bus] Publish failed for \${signalName}: \${err.message}\`))
}

function dispatchSignalHttp(signalName: string, capability: string, payload: Record<string, any>): void {
  const urls = dispatchConfig[signalName] ?? []
  if (!urls.length) return
  const body = JSON.stringify({
    signal: signalName,
    capability,
    payload,
    timestamp: new Date().toISOString(),
  })
  for (const baseUrl of urls) {
    const url = \`\${baseUrl.replace(/\\/$/, '')}/_signals/\${signalName}\`
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then(res => {
        if (res.ok) console.log(\`[signal-dispatch] Dispatched \${signalName} → \${url}\`)
        else console.warn(\`[signal-dispatch] \${url} responded \${res.status}\`)
      })
      .catch(err => console.error(\`[signal-dispatch] Failed: \${url} — \${err.message}\`))
  }
}

export function createSignalMiddleware(endpoint: any, api: any, operational: any) {
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const outcome = operational.outcomes?.find((o: any) => o.capability === capability)
  const emits = outcome?.emits as string[] | undefined

  if (!emits?.length) {
    return (_req: Request, _res: Response, next: NextFunction) => next()
  }

  const signals = operational.signals ?? []

  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res)

    res.json = function (data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const signalName of emits!) {
          const signalDef = signals.find((s: any) => s.name === signalName)
          if (!signalDef) continue

          const payload: Record<string, any> = {}
          for (const field of signalDef.payload) {
            if (data[field.name] !== undefined) {
              payload[field.name] = data[field.name]
            }
          }

          publishSignal(signalName, capability, payload)
          dispatchSignalHttp(signalName, capability, payload)
        }
      }
      return originalJson(data)
    }

    next()
  }
}
`
}

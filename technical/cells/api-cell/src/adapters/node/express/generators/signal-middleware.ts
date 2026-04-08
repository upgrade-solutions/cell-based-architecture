/**
 * Generates Express middleware that automatically emits DNA Signals
 * after handler responses. Uses amqplib to publish to RabbitMQ.
 *
 * Per-route: resolves the capability from the endpoint, checks if the
 * Outcome has `emits`, and if so wraps res.json to capture the entity
 * and publish each signal with typed payload fields.
 */
export function generateSignalMiddleware(): string {
  return `import { Request, Response, NextFunction } from 'express'

const amqp = require('amqplib')

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || ''
const EXCHANGE = 'signals'

let connection: any = null
let channel: any = null

export async function connectEventBus(): Promise<void> {
  if (!EVENT_BUS_URL) {
    console.log('[event-bus] EVENT_BUS_URL not set — signal emission disabled')
    return
  }
  try {
    console.log(\`[event-bus] Connecting to \${EVENT_BUS_URL}...\`)
    connection = await amqp.connect(EVENT_BUS_URL)
    channel = await connection.createChannel()
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
    console.log('[event-bus] Connected.')
  } catch (err: any) {
    console.error(\`[event-bus] Connection failed: \${err.message} — signals will be skipped\`)
  }
}

export async function disconnectEventBus(): Promise<void> {
  if (channel) { await channel.close().catch(() => {}); channel = null }
  if (connection) { await connection.close().catch(() => {}); connection = null }
  console.log('[event-bus] Disconnected.')
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
          publishSignal(signalName, capability, payload)
        }
      }
      return originalJson(data)
    }

    next()
  }
}
`
}

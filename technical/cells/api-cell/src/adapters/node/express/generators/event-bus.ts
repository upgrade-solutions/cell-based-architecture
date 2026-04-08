/**
 * Generates the event-bus client for the Express runtime interpreter.
 * Provides emitSignals() which publishes signals after Outcome changes.
 */
export function generateEventBus(): string {
  return `const EVENT_BUS_URL = process.env.EVENT_BUS_URL || ''

/**
 * After an Outcome is applied, emit any Signals declared in outcome.emits.
 * Each signal publishes the entity snapshot as payload to EVENT_BUS_URL.
 * If EVENT_BUS_URL is not set, signal emission is silently skipped.
 */
export async function emitSignals(
  capability: string,
  operational: any,
  entity: Record<string, any>,
): Promise<void> {
  const outcome = operational.outcomes?.find((o: any) => o.capability === capability)
  if (!outcome?.emits?.length) return
  if (!EVENT_BUS_URL) return

  const signals = operational.signals ?? []

  for (const signalName of outcome.emits) {
    const signalDef = signals.find((s: any) => s.name === signalName)
    if (!signalDef) {
      console.warn(\`[event-bus] Signal "\${signalName}" not found in operational DNA — skipping.\`)
      continue
    }

    // Build typed payload from entity using the signal's payload field definitions
    const payload: Record<string, any> = {}
    for (const field of signalDef.payload) {
      if (entity[field.name] !== undefined) {
        payload[field.name] = entity[field.name]
      }
    }

    const message = {
      signal: signalName,
      capability,
      payload,
      timestamp: new Date().toISOString(),
    }

    try {
      console.log(\`[event-bus] Emitting \${signalName}\`, JSON.stringify(payload))
      // Fire-and-forget publish to EVENT_BUS_URL
      // In production, this would use amqplib (RabbitMQ) or AWS SNS
      // For now, POST the message to the bus URL
      await fetch(EVENT_BUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }).catch(err => {
        console.error(\`[event-bus] Failed to emit \${signalName}:\`, err.message)
      })
    } catch (err: any) {
      console.error(\`[event-bus] Failed to emit \${signalName}:\`, err.message)
    }
  }
}
`
}

export interface OutputOptions {
  json: boolean
}

export function emit(data: unknown, opts: OutputOptions, humanFormatter: () => string): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2))
  } else {
    console.log(humanFormatter())
  }
}

export function emitError(message: string, opts: OutputOptions, extra: Record<string, unknown> = {}): void {
  if (opts.json) {
    console.error(JSON.stringify({ ok: false, error: message, ...extra }, null, 2))
  } else {
    console.error(`Error: ${message}`)
  }
}

export function emitOk(data: Record<string, unknown>, opts: OutputOptions, humanFormatter: () => string): void {
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, ...data }, null, 2))
  } else {
    console.log(humanFormatter())
  }
}

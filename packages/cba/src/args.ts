export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | boolean>
}

/**
 * Minimal argv parser. Supports:
 *   --flag              → true
 *   --flag value        → "value"
 *   --flag=value        → "value"
 *   positional args     → in order
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq > -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      } else {
        const name = arg.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          flags[name] = next
          i++
        } else {
          flags[name] = true
        }
      }
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

export function flag(args: ParsedArgs, name: string): string | undefined {
  const v = args.flags[name]
  return typeof v === 'string' ? v : undefined
}

export function boolFlag(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true || args.flags[name] === 'true'
}

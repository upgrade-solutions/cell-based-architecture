export function hashes(count: number): string {
  return '#'.repeat(Math.max(1, Math.min(6, count)))
}

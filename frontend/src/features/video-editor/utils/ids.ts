export function makeId(_prefix?: string): string {
  return crypto.randomUUID()
}

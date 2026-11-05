import { useMemo } from "react"

const STORAGE_PREFIX = "sohizi:stable-random:"

export function pickNonRepeatingIndex(
  length: number,
  lastIndex: number | null,
  random: () => number = Math.random,
): number {
  if (length <= 1) return 0
  if (lastIndex === null || lastIndex < 0 || lastIndex >= length) {
    return Math.floor(random() * length)
  }
  const offset = 1 + Math.floor(random() * (length - 1))
  return (lastIndex + offset) % length
}

function readLastIndex(storageKey: string): number | null {
  try {
    if (typeof window === "undefined") return null
    const raw = window.sessionStorage.getItem(storageKey)
    if (raw === null) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isNaN(parsed) ? null : parsed
  } catch {
    return null
  }
}

function writeLastIndex(storageKey: string, index: number): void {
  try {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(storageKey, String(index))
  } catch {
    // Ignore storage errors (private mode, quota, SSR)
  }
}

/**
 * Picks one item from `items` and keeps it stable for a given `key`
 * (e.g. active conversation id), avoiding back-to-back repeats via sessionStorage.
 */
export function useStableRandom<T>(
  items: ReadonlyArray<T>,
  key: string,
  namespace = "default",
): T {
  const storageKey = `${STORAGE_PREFIX}${namespace}`
  const length = items.length

  const index = useMemo(() => {
    const last = readLastIndex(storageKey)
    const next = pickNonRepeatingIndex(length, last)
    writeLastIndex(storageKey, next)
    return next
    // `key` intentionally drives re-picking when the conversation changes.
  }, [key, length, storageKey])

  return items[index] ?? items[0]
}

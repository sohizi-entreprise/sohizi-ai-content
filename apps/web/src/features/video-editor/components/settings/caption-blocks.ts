import type { ServerCaption } from "../../store/types"

export interface CaptionTimestampBlock {
  start: number
  end: number
  text: string
}

const PAUSE_SECONDS = 0.6
const MAX_BLOCK_SECONDS = 4

export function groupCaptionBlocks(
  words: Array<ServerCaption>,
): Array<CaptionTimestampBlock> {
  if (words.length === 0) return []

  const sorted = [...words].sort((a, b) => a.start - b.start)
  const blocks: Array<CaptionTimestampBlock> = []
  let current: Array<ServerCaption> = []

  const flush = () => {
    if (current.length === 0) return
    const first = current[0]
    const last = current[current.length - 1]
    const text = joinCaptionWords(current)
    if (text) {
      blocks.push({ start: first.start, end: last.end, text })
    }
    current = []
  }

  for (const word of sorted) {
    const previous = current[current.length - 1]
    if (!previous) {
      current.push(word)
      continue
    }

    const gap = word.start - previous.end
    const duration = word.end - current[0].start
    const sentenceEnded = /[.!?]["']?$/.test(previous.word.trim())
    if (
      gap > PAUSE_SECONDS ||
      sentenceEnded ||
      duration > MAX_BLOCK_SECONDS
    ) {
      flush()
    }
    current.push(word)
  }

  flush()
  return blocks
}

function joinCaptionWords(words: Array<ServerCaption>): string {
  return words
    .map((entry) => entry.word.trim())
    .filter(Boolean)
    .join(" ")
}

export function formatCaptionTimestamp(seconds: number): string {
  const hundredths = Math.max(0, Math.round(seconds * 100))
  const minutes = Math.floor(hundredths / 6000)
  const remainder = hundredths % 6000
  const whole = Math.floor(remainder / 100)
  const fraction = remainder % 100
  return `${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`
}

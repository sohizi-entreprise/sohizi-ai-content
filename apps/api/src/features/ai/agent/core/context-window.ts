import type { ModelMessage } from "ai"
import { extractTextFromContent } from "../utils/message-content"
import { isDurableSystemMessage } from "./system-persist"

export const RETAINED_RUNS = 5

const SYNTHETIC_KINDS = new Set([
  "context-summary",
  "context-note",
  "context-continuation",
])

export type CompressionWindow = {
  mainSystem: ModelMessage[]
  older: ModelMessage[]
  retained: ModelMessage[]
}

export function isRealUserTurn(message: ModelMessage): boolean {
  if (message.role !== "user") return false
  const kind = message.providerOptions?.sohizi?.kind
  if (typeof kind === "string" && SYNTHETIC_KINDS.has(kind)) return false
  const text = extractTextFromContent(message.content).trimStart()
  return (
    !text.startsWith("Summary of the earlier conversation") &&
    !text.startsWith(
      "The earlier messages in this conversation have been summarized",
    ) &&
    text !== "Please continue with the task."
  )
}

export function selectCompressionWindow(
  messages: ModelMessage[],
  keepRuns = RETAINED_RUNS,
): CompressionWindow {
  const mainSystem = messages.filter(isMainSystemMessage)
  const rest = messages.filter((message) => !isMainSystemMessage(message))
  const turns = rest.flatMap((message, index) =>
    isRealUserTurn(message) ? [index] : [],
  )
  if (turns.length === 0) {
    return { mainSystem, older: [], retained: rest }
  }

  const firstKept = turns[Math.max(0, turns.length - keepRuns)] ?? 0
  const start =
    firstKept > 0 && isDurableSystemMessage(rest[firstKept - 1]!)
      ? firstKept - 1
      : firstKept
  return {
    mainSystem,
    older: rest.slice(0, start).filter((message) => message.role !== "system"),
    retained: pruneUnpairedDurablePrompts(rest.slice(start)),
  }
}

export function splitRetainedRuns(retained: ModelMessage[]): {
  earlier: ModelMessage[]
  latest: ModelMessage[]
} {
  let lastTurn = -1
  for (let index = 0; index < retained.length; index += 1) {
    if (isRealUserTurn(retained[index]!)) lastTurn = index
  }
  if (lastTurn < 0) return { earlier: [], latest: retained }
  const start =
    lastTurn > 0 && isDurableSystemMessage(retained[lastTurn - 1]!)
      ? lastTurn - 1
      : lastTurn
  return {
    earlier: retained.slice(0, start),
    latest: retained.slice(start),
  }
}

function pruneUnpairedDurablePrompts(messages: ModelMessage[]): ModelMessage[] {
  return messages.filter((message, index) => {
    if (!isDurableSystemMessage(message)) return true
    const next = messages[index + 1]
    return Boolean(next && isRealUserTurn(next))
  })
}

function isMainSystemMessage(message: ModelMessage): boolean {
  return message.role === "system" && !isDurableSystemMessage(message)
}

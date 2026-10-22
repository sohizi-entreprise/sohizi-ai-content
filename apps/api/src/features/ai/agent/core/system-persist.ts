import type { ModelMessage, SystemModelMessage } from "ai"

const DURABLE_PERSIST = "durable"

export function durableSystemMessage(content: string): SystemModelMessage {
  return {
    role: "system",
    content,
    providerOptions: {
      sohizi: { persist: DURABLE_PERSIST },
    },
  }
}

export function isDurableSystemMessage(
  message: ModelMessage,
): message is SystemModelMessage {
  return (
    message.role === "system" &&
    message.providerOptions?.sohizi?.persist === DURABLE_PERSIST
  )
}

export function messagesForCheckpoint(
  messages: ModelMessage[],
): ModelMessage[] {
  return messages.filter(
    (message) => message.role !== "system" || isDurableSystemMessage(message),
  )
}

export function restoreSessionMessages(
  systemPrompt: string,
  existing: ModelMessage[],
): ModelMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...messagesForCheckpoint(existing),
  ]
}

export function withoutSohiziProviderOptions(
  messages: ModelMessage[],
): ModelMessage[] {
  return messages.map((message) => {
    if (!message.providerOptions?.sohizi) return message
    const { sohizi: _sohizi, ...providerOptions } = message.providerOptions
    if (Object.keys(providerOptions).length === 0) {
      const { providerOptions: _removed, ...rest } = message
      return rest
    }
    return { ...message, providerOptions }
  })
}

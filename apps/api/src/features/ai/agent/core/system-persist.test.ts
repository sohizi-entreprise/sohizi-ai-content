import { describe, expect, it } from "bun:test"
import type { ModelMessage } from "ai"
import {
  durableSystemMessage,
  messagesForCheckpoint,
  restoreSessionMessages,
  withoutSohiziProviderOptions,
} from "./system-persist"

const user = (text: string): ModelMessage => ({
  role: "user",
  content: text,
})

const assistant = (text: string): ModelMessage => ({
  role: "assistant",
  content: text,
})

describe("messagesForCheckpoint", () => {
  it("drops the main prompt and keeps the editor context ahead of the user message", () => {
    const durable = durableSystemMessage("editor run 1")
    const messages: ModelMessage[] = [
      { role: "system", content: "main prompt" },
      durable,
      user("first"),
      assistant("reply"),
    ]

    expect(messagesForCheckpoint(messages)).toEqual([
      durable,
      user("first"),
      assistant("reply"),
    ])
  })

  it("keeps each run's editor context ahead of that run's user message", () => {
    const first = durableSystemMessage("editor run 1")
    const second = durableSystemMessage("editor run 2")
    const restored = restoreSessionMessages("fresh main prompt", [
      first,
      user("first"),
      assistant("reply"),
    ])
    const nextRun: ModelMessage[] = [
      ...restored,
      second,
      user("second"),
      assistant("another reply"),
    ]

    expect(messagesForCheckpoint(nextRun)).toEqual([
      first,
      user("first"),
      assistant("reply"),
      second,
      user("second"),
      assistant("another reply"),
    ])
  })
})

describe("withoutSohiziProviderOptions", () => {
  it("removes the sohizi flag from the model copy and leaves the stored message intact", () => {
    const durable = durableSystemMessage("editor run 1")

    const [modelCopy] = withoutSohiziProviderOptions([durable])

    expect(modelCopy?.providerOptions).toBeUndefined()
    expect(durable.providerOptions?.sohizi?.persist).toBe("durable")
  })
})

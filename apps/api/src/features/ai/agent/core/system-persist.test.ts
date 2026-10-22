import { describe, expect, it } from "bun:test"
import type { ModelMessage } from "ai"
import {
  contextNote,
  contextSummaryMessage,
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

  it("keeps a compressed summary and artifact reference, but not the main prompt", () => {
    const summary = contextSummaryMessage("Earlier work")
    const toolResult: ModelMessage = {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "exploreFile",
          output: {
            type: "text",
            value: "preview\nFull tool result saved as artifact art-1.",
          },
        },
      ],
    }
    const checkpoint = messagesForCheckpoint([
      { role: "system", content: "main prompt" },
      summary,
      toolResult,
    ])

    expect(checkpoint).toEqual([summary, toolResult])
  })

  it("keeps internal context notes for the active context", () => {
    const note = contextNote("A background job completed.")
    const retained = messagesForCheckpoint([note, user("real user message")])

    expect(retained).toEqual([note, user("real user message")])
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

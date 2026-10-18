import { describe, expect, it } from "bun:test"
import type { ModelMessage } from "ai"
import { ContextManager } from "./context-manager"
import { AgentStateManager } from "./state-manager"
import type { Session } from "./session"

function manager() {
  return new ContextManager({
    maxContextTokens: 1_000_000,
    threshold: 0.8,
    session: { resolveModel: async () => null } as unknown as Session,
    summaryModelId: "unavailable",
  })
}

function toolMessage(value: string): ModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: "call-1",
        toolName: "exploreFile",
        output: { type: "text", value },
      },
    ],
  }
}

describe("ContextManager compression threshold", () => {
  it("does not compress a 102K-token step against a 1M window", async () => {
    const state = new AgentStateManager()
    const messages = [toolMessage("x".repeat(300))]
    state.replaceMessages(messages)

    await manager().maybeCompress(
      state,
      102_000,
      new AbortController().signal,
      "run-1",
    )

    expect(state.getState().messages).toBe(messages)
  })

  it("compresses at 80% even when the step finished the turn", async () => {
    const state = new AgentStateManager()
    state.replaceMessages([toolMessage("x".repeat(300))])
    state.finishRun()

    await manager().maybeCompress(
      state,
      800_000,
      new AbortController().signal,
      "run-1",
    )

    const message = state.getState().messages[0]
    expect(message?.role).toBe("tool")
    if (message?.role !== "tool") throw new Error("Expected a tool message")
    expect(message.content[0]?.type).toBe("tool-result")
    if (message.content[0]?.type !== "tool-result") {
      throw new Error("Expected a tool result")
    }
    expect(message.content[0].output).toEqual({
      type: "text",
      value: `${"x".repeat(200)}...[CONCANATED]`,
    })
  })

  it("does not add continuation messages when there is nothing to reduce", async () => {
    const messages: ModelMessage[] = [{ role: "user", content: "Hello" }]
    const result = await manager().compress(messages, async () => "unused")
    expect(result).toBe(messages)
  })

  it("does not add a continuation prompt after a finished turn", async () => {
    const messages: ModelMessage[] = Array.from({ length: 17 }, (_, index) => ({
      role: "user",
      content: `Message ${index}`,
    }))
    const result = await manager().compress(
      messages,
      async () => "Earlier work",
      false,
    )
    expect(result).toHaveLength(16)
    expect(JSON.stringify(result)).not.toContain(
      "Please continue with the task",
    )
  })
})

import { describe, expect, it } from "bun:test"
import type { ModelMessage } from "ai"
import { ContextManager } from "./context-manager"
import type { Session } from "./session"
import { durableSystemMessage } from "./system-persist"
import { TOOL_RESULT_PREVIEW_LENGTH } from "./context-artifact-format"

const session = {
  id: "session-1",
  projectId: "project-1",
  conversationId: "conversation-1",
  resolveModel: async () => null,
} as unknown as Session

function manager(save: (rows: unknown[]) => Promise<string[]>) {
  return new ContextManager({
    maxContextTokens: 1_000_000,
    session,
    summaryModelId: "summary",
    artifactStore: { save: save as never },
  })
}

function toolResult(value: string, toolCallId: string): ModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId,
        toolName: "exploreFile",
        output: { type: "text", value },
      },
    ],
  }
}

describe("run-aware context compression", () => {
  it("summarizes history outside five real turns and artifactizes only older retained tool results", async () => {
    const saved: Array<{ data: { output: { value: string } } }> = []
    const long = "x".repeat(100)
    const messages: ModelMessage[] = [
      { role: "system", content: "main prompt" },
      durableSystemMessage("editor 1"),
      { role: "user", content: "turn 1" },
      toolResult(long, "old-tool"),
      ...[2, 3, 4, 5].flatMap((turn) => [
        durableSystemMessage(`editor ${turn}`),
        { role: "user", content: `turn ${turn}` } as ModelMessage,
        toolResult(long, `tool-${turn}`),
      ]),
      durableSystemMessage("stale editor"),
      durableSystemMessage("editor 6"),
      { role: "user", content: "turn 6" },
      toolResult("latest full result", "latest-tool"),
    ]

    let transcript = ""
    const result = await manager(async (rows) => {
      saved.push(...(rows as typeof saved))
      return rows.map((_, index) => `art-${index + 1}`)
    }).compress(
      messages,
      async ({ transcript: value, systemPrompt }) => {
        transcript = value
        expect(systemPrompt).toContain(
          "This older history is not stored anywhere else",
        )
        return "Earlier work"
      },
      false,
    )

    expect(transcript).toContain("turn 1")
    expect(transcript).toContain(long)
    expect(transcript).not.toContain("turn 2")
    expect(saved).toHaveLength(4)
    expect(saved.map((row) => row.data.output.value)).toEqual([
      long,
      long,
      long,
      long,
    ])
    expect(JSON.stringify(result)).not.toContain("editor 1")
    expect(JSON.stringify(result)).not.toContain("stale editor")
    expect(JSON.stringify(result)).toContain("editor 2")
    expect(JSON.stringify(result)).toContain("editor 6")
    expect(JSON.stringify(result)).toContain("latest full result")
    expect(JSON.stringify(result)).not.toContain("old-tool")
    const preview = "x".repeat(TOOL_RESULT_PREVIEW_LENGTH)
    expect(JSON.stringify(result)).toContain(
      `${preview}...\\nFull tool result saved as artifact art-1`,
    )
    expect(result[0]).toMatchObject({ role: "system", content: "main prompt" })
    expect(JSON.stringify(result[1])).toContain("Earlier work")
  })

  it("does not treat a previous summary as one of the five real turns", async () => {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Summary of the earlier conversation (older messages were condensed to save context):\n\nOld",
          },
        ],
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        role: "user" as const,
        content: `turn ${index + 1}`,
      })),
    ]
    let summarized = ""
    const result = await manager(async () => []).compress(
      messages,
      async ({ transcript }) => {
        summarized = transcript
        return "Combined"
      },
      false,
    )

    expect(summarized).toContain("Old")
    expect(summarized).not.toContain("turn 1")
    expect(result).toHaveLength(6)
  })
})

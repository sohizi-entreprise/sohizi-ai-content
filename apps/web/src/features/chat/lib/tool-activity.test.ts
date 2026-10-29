import { describe, expect, it } from "vitest"
import {
  buildRunPresentation,
  formatElapsedDuration,
  getGranularToolDescriptor,
  getToolActivity,
  summarizeToolGroup,
} from "./tool-activity"
import type { Message, MsgToolCallPart } from "../types"

function call(
  toolName: string,
  input: unknown,
  isStreaming = true,
  toolCallId = "test",
): MsgToolCallPart {
  return { type: "tool-call", toolCallId, toolName, input, isStreaming }
}

describe("getToolActivity", () => {
  it("describes a grouped file operation without showing its endpoint", () => {
    expect(
      getToolActivity(call("fileSystemAPI", { endpoint: "/files/patch" })),
    ).toBe("Editing a file")
    expect(
      getToolActivity(
        call("fileSystemAPI", { endpoint: "/files/patch" }, false),
      ),
    ).toBe("Edited a file")
  })

  it("uses a useful label before a streaming input has an endpoint", () => {
    expect(getToolActivity(call("videoEditorAPI", {}))).toBe(
      "Working on the video",
    )
  })

  it("describes generated media by type", () => {
    expect(
      getToolActivity(
        call("mediaOperationsAPI", {
          endpoint: "/media/assets/generate",
          body: { kind: "video" },
        }),
      ),
    ).toBe("Creating a video")
  })

  it("leaves legacy tools to their existing renderers", () => {
    expect(getToolActivity(call("exploreFile", {}))).toBeNull()
  })
})

describe("getGranularToolDescriptor", () => {
  it("extracts file basename and FileRef for /files/read", () => {
    const active = getGranularToolDescriptor(
      call(
        "fileSystemAPI",
        {
          endpoint: "/files/read",
          params: { filePath: "/root/core/agent.ts" },
        },
        true,
      ),
    )
    expect(active.text).toBe("Reading agent.ts")
    expect(active.fromRef).toEqual({
      kind: "path",
      path: "/root/core/agent.ts",
    })

    const complete = getGranularToolDescriptor(
      call(
        "fileSystemAPI",
        {
          endpoint: "/files/read",
          params: { filePath: "/root/core/agent.ts" },
        },
        false,
      ),
    )
    expect(complete.text).toBe("Read agent.ts")
    expect(complete.category).toBe("read-file")
  })

  it("extracts search query for /files/search", () => {
    const desc = getGranularToolDescriptor(
      call(
        "fileSystemAPI",
        {
          endpoint: "/files/search",
          params: { query: "maxStep | runLoop" },
        },
        false,
      ),
    )
    expect(desc.text).toBe("Searched for maxStep | runLoop")
    expect(desc.category).toBe("search-file")
  })

  it("describes apiDocRead tool loading", () => {
    const desc = getGranularToolDescriptor(
      call("apiDocRead", { api: "webAPI" }, false),
    )
    expect(desc.text).toBe("Loaded web tool")
    expect(desc.category).toBe("load-tool")
  })

  it("describes contextCompaction active and completed states", () => {
    expect(
      getGranularToolDescriptor(call("contextCompaction", {}, true)).text,
    ).toBe("Compacting context - This can take a few minutes")
    expect(
      getGranularToolDescriptor(call("contextCompaction", {}, false)).text,
    ).toBe("Context automatically compacted")
  })
})

describe("summarizeToolGroup", () => {
  it("rolls up mixed consecutive tools in order of appearance", () => {
    const group = summarizeToolGroup([
      call("apiDocRead", { api: "webAPI" }, false, "1"),
      call(
        "fileSystemAPI",
        { endpoint: "/files/read", params: { filePath: "/root/a.ts" } },
        false,
        "2",
      ),
      call(
        "fileSystemAPI",
        { endpoint: "/files/read", params: { filePath: "/root/b.ts" } },
        false,
        "3",
      ),
      call(
        "webAPI",
        { endpoint: "/web/search", params: { query: "loop guard" } },
        false,
        "4",
      ),
    ])
    expect(group.summary).toBe("Loaded a tool, read files, searched the web")
  })

  it("rolls up multiple file reads into 'Read files'", () => {
    const group = summarizeToolGroup([
      call(
        "fileSystemAPI",
        { endpoint: "/files/read", params: { filePath: "/root/a.ts" } },
        false,
        "1",
      ),
      call(
        "fileSystemAPI",
        { endpoint: "/files/read", params: { filePath: "/root/b.ts" } },
        false,
        "2",
      ),
    ])
    expect(group.summary).toBe("Read files")
  })
})

describe("buildRunPresentation", () => {
  it("groups sequential micro-tools, separates status notes & compaction, and extracts the final response", () => {
    const messages: Array<Message> = [
      {
        id: "user-1",
        createdAt: "2026-10-29T11:10:00.000Z",
        role: "user",
        content: [{ type: "text", text: "How do we prevent agent loops?" }],
      },
      {
        id: "asst-1",
        createdAt: "2026-10-29T11:10:02.000Z",
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "status-1",
            toolName: "provideStatusUpdate",
            input: {
              message:
                "I'll look at the agent's run loop and tool dispatch, then suggest where to detect repeated behavior.",
            },
            isStreaming: false,
          },
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "apiDocRead",
            input: { api: "fileSystemAPI" },
            isStreaming: false,
          },
          {
            type: "tool-call",
            toolCallId: "tc-2",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/read",
              params: { filePath: "/root/agent.ts" },
            },
            isStreaming: false,
          },
          {
            type: "tool-call",
            toolCallId: "tc-3",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/read",
              params: { filePath: "/root/tracing.ts" },
            },
            isStreaming: false,
          },
          {
            type: "tool-call",
            toolCallId: "compact-1",
            toolName: "contextCompaction",
            input: {},
            isStreaming: false,
          },
          {
            type: "tool-call",
            toolCallId: "tc-4",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/read",
              params: { filePath: "/root/session.ts" },
            },
            isStreaming: false,
          },
          {
            type: "tool-call",
            toolCallId: "tc-5",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/read",
              params: { filePath: "/root/persistence.ts" },
            },
            isStreaming: false,
          },
        ],
      },
      {
        id: "asst-2",
        createdAt: "2026-10-29T11:11:13.000Z",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'd add a **loop guard** in `Agent.runLoop`.",
            isStreaming: false,
          },
        ],
      },
    ]

    const presentation = buildRunPresentation(messages, {
      firstAddToolCallId: null,
      hasTasks: false,
    })

    expect(presentation.userMessages).toHaveLength(1)
    expect(presentation.timelineItems.map((i) => i.kind)).toEqual([
      "status-note",
      "tool-group",
      "compaction",
      "tool-group",
    ])
    const firstGroup = presentation.timelineItems[1]
    if (firstGroup.kind === "tool-group") {
      expect(firstGroup.summary).toBe("Loaded a tool, read files")
      expect(firstGroup.toolCalls).toHaveLength(3)
    }
    const secondGroup = presentation.timelineItems[3]
    if (secondGroup.kind === "tool-group") {
      expect(secondGroup.summary).toBe("Read files")
      expect(secondGroup.toolCalls).toHaveLength(2)
    }
    expect(presentation.finalResponse?.text).toBe(
      "I'd add a **loop guard** in `Agent.runLoop`.",
    )
  })
})

describe("formatElapsedDuration", () => {
  it("formats seconds and minutes cleanly", () => {
    expect(formatElapsedDuration(0)).toBe("1s")
    expect(formatElapsedDuration(14)).toBe("14s")
    expect(formatElapsedDuration(60)).toBe("1m")
    expect(formatElapsedDuration(73)).toBe("1m 13s")
  })
})

import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { ToolExecutionOptions, ToolResult } from "../tool-definition"

const captures: Array<{
  youtubeUrl: string
  seconds?: number
  userId: string
}> = []
let accessAllowed = true
let captureResponse = Response.json({
  id: "extraction-1",
  url: "https://media-dev.sohizi.com/youtube_extractions/extraction-1.png",
  requestedSeconds: 42,
  capturedSeconds: 42.1,
})

mock.module("@/lib/authorize", () => ({
  assertProjectAccess: async () => {
    if (!accessAllowed) throw new Error("Project access denied")
  },
  assertOrgMember: async () => {},
  assertConversationOwner: async () => {},
  assertAdmin: () => {},
  requireActiveOrganization: () => "organization-1",
}))

mock.module("@/features/media-engine/youtube-screenshot", () => ({
  captureYoutubeScreenshot: async (
    input: { youtubeUrl: string; seconds?: number },
    userId: string,
  ) => {
    captures.push({ ...input, userId })
    return captureResponse
  },
}))

const { apiMediaOperationsTool, youtubeScreenshotTool } =
  await import("./index")

const options = {
  session: { userId: "user-1", projectId: "project-1" },
} as ToolExecutionOptions

beforeEach(() => {
  captures.length = 0
  accessAllowed = true
  captureResponse = Response.json({
    id: "extraction-1",
    url: "https://media-dev.sohizi.com/youtube_extractions/extraction-1.png",
    requestedSeconds: 42,
    capturedSeconds: 42.1,
  })
})

describe("YouTube screenshot agent tool", () => {
  test("passes a URL and timestamp through the media API handler", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/youtube-screenshot",
        method: "POST",
        body: { youtubeUrl: "https://youtu.be/example?t=5", seconds: 42 },
      },
      options,
    )) as ToolResult

    expect(result.success).toBe(true)
    expect(captures).toEqual([
      {
        youtubeUrl: "https://youtu.be/example?t=5",
        seconds: 42,
        userId: "user-1",
      },
    ])
    expect(JSON.parse(result.output)).toEqual({
      id: "extraction-1",
      url: "https://media-dev.sohizi.com/youtube_extractions/extraction-1.png",
      requestedSeconds: 42,
      capturedSeconds: 42.1,
    })
  })

  test("exposes the operation as a dedicated agent tool", async () => {
    const result = (await youtubeScreenshotTool.params.execute(
      { youtubeUrl: "https://www.youtube.com/watch?v=example" },
      options,
    )) as ToolResult

    expect(result.success).toBe(true)
    expect(captures[0]?.seconds).toBeUndefined()
  })

  test("returns a retryable capacity failure", async () => {
    captureResponse = Response.json(
      { error: "Screenshot capacity reached; retry later" },
      { status: 429, headers: { "Retry-After": "5" } },
    )

    const result = (await youtubeScreenshotTool.params.execute(
      { youtubeUrl: "https://youtu.be/example" },
      options,
    )) as ToolResult

    expect(result).toEqual({
      success: false,
      output:
        "Screenshot capacity reached; retry later. Retry after 5 seconds.",
    })
  })

  test("does not capture when project access is denied", async () => {
    accessAllowed = false

    const result = (await youtubeScreenshotTool.params.execute(
      { youtubeUrl: "https://youtu.be/example" },
      options,
    )) as ToolResult

    expect(result.success).toBe(false)
    expect(captures).toHaveLength(0)
  })

  test("rejects timestamps outside the HTTP endpoint range", () => {
    expect(
      youtubeScreenshotTool.params.inputSchema.safeParse({
        youtubeUrl: "https://youtu.be/example",
        seconds: 86401,
      }).success,
    ).toBe(false)
  })
})

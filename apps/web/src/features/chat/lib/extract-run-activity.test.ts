import { describe, expect, it } from "vitest"
import {
  extractLatestRunActivity,
  extractRunActivity,
} from "./extract-run-activity"
import type { AgentRunBlock, Message } from "../types"

describe("extractRunActivity", () => {
  it("extracts created files, created directories, and updated files", () => {
    const messages: Array<Message> = [
      {
        id: "asst-1",
        createdAt: "2026-11-08T10:00:00.000Z",
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/create",
              body: {
                parentDirectoryPath: "/root",
                name: "scenes",
                dir: true,
                type: "document",
                format: "markdown",
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "fileSystemAPI",
            output: {
              type: "text",
              value: 'Created directory "scenes" successfully.',
            },
          },
          {
            type: "tool-call",
            toolCallId: "tc-2",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/create",
              body: {
                parentDirectoryPath: "/root/scenes",
                name: "intro.storyboard.md",
                dir: false,
                type: "storyboard",
                format: "markdown",
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-2",
            toolName: "fileSystemAPI",
            output: {
              type: "text",
              value: 'Created file "intro.storyboard.md" successfully.',
            },
          },
          {
            type: "tool-call",
            toolCallId: "tc-3",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/write",
              body: {
                filePath: "/root/scenes/intro.storyboard.md",
                content: "# Scene 1",
                strategy: "overwrite",
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-3",
            toolName: "fileSystemAPI",
            output: {
              type: "text",
              value: "Content written",
            },
          },
          {
            type: "tool-call",
            toolCallId: "tc-4",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/patch",
              body: {
                filePath: "/root/core/brief",
                oldText: "draft",
                newText: "final",
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-4",
            toolName: "fileSystemAPI",
            output: {
              type: "text",
              value: "Content patched",
            },
          },
        ],
      },
    ]

    const activity = extractRunActivity("run-1", messages)

    expect(activity.files).toEqual([
      {
        id: "/root/scenes",
        name: "scenes",
        path: "/root/scenes",
        fileId: null,
        tag: "created",
        isDirectory: true,
        fileType: "document",
        format: "markdown",
      },
      {
        id: "/root/scenes/intro.storyboard.md",
        name: "intro.storyboard.md",
        path: "/root/scenes/intro.storyboard.md",
        fileId: null,
        tag: "created",
        isDirectory: false,
        fileType: "storyboard",
        format: "markdown",
      },
      {
        id: "/root/core/brief",
        name: "brief",
        path: "/root/core/brief",
        fileId: null,
        tag: "updated",
        isDirectory: false,
        fileType: null,
        format: null,
      },
    ])
  })

  it("extracts saved media assets and video editor mutations, ignoring failed tool calls", () => {
    const messages: Array<Message> = [
      {
        id: "asst-1",
        createdAt: "2026-11-08T10:00:00.000Z",
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-save",
            toolName: "mediaOperationsAPI",
            input: {
              endpoint: "/media/assets/save",
              body: {
                fileName: "hero.png",
                directoryPath: "/root/assets",
                assetId: "11111111-1111-4111-8111-111111111111",
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-save",
            toolName: "mediaOperationsAPI",
            output: {
              type: "text",
              value: JSON.stringify({
                fileId: "22222222-2222-4222-8222-222222222222",
                name: "hero.png",
                path: "/root/assets/hero.png",
                type: "image",
                format: "file",
              }),
            },
          },
          {
            type: "tool-call",
            toolCallId: "tc-video",
            toolName: "videoEditorAPI",
            input: {
              endpoint: "/video-editor/batch",
              body: {
                filePath: "/root/timeline",
                operations: [],
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-video",
            toolName: "videoEditorAPI",
            output: {
              type: "text",
              value: "Executed batch operations",
            },
          },
          {
            type: "tool-call",
            toolCallId: "tc-err",
            toolName: "fileSystemAPI",
            input: {
              endpoint: "/files/write",
              body: {
                filePath: "/root/missing.md",
                content: "nope",
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-err",
            toolName: "fileSystemAPI",
            output: {
              type: "error-text",
              value: "File not found",
            },
          },
        ],
      },
    ]

    const activity = extractRunActivity("run-2", messages)

    expect(activity.files).toEqual([
      {
        id: "/root/assets/hero.png",
        name: "hero.png",
        path: "/root/assets/hero.png",
        fileId: "22222222-2222-4222-8222-222222222222",
        tag: "created",
        isDirectory: false,
        fileType: "image",
        format: "file",
      },
      {
        id: "/root/timeline",
        name: "timeline",
        path: "/root/timeline",
        fileId: null,
        tag: "updated",
        isDirectory: false,
        fileType: "video-editor",
        format: null,
      },
    ])
  })

  it("extracts media generation requests and reconciles with waitForJob and job_update notes", () => {
    const messages: Array<Message> = [
      {
        id: "asst-1",
        createdAt: "2026-11-08T10:00:00.000Z",
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-gen-1",
            toolName: "mediaOperationsAPI",
            input: {
              endpoint: "/media/assets/generate",
              body: {
                kind: "image",
                label: "Cyberpunk alleyway",
                modelId: "flux-pro",
                parameters: { prompt: "Neon lit cyberpunk alley" },
              },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-gen-1",
            toolName: "mediaOperationsAPI",
            output: {
              type: "text",
              value: JSON.stringify({
                jobId: "job-101",
                status: "queued",
                kind: "image",
                label: "Cyberpunk alleyway",
              }),
            },
          },
          {
            type: "tool-call",
            toolCallId: "tc-wait-1",
            toolName: "mediaOperationsAPI",
            input: {
              endpoint: "/media/jobs/wait",
              body: { jobId: "job-101" },
            },
            isStreaming: false,
          },
          {
            type: "tool-result",
            toolCallId: "tc-wait-1",
            toolName: "mediaOperationsAPI",
            output: {
              type: "text",
              value: JSON.stringify({
                jobId: "job-101",
                status: "completed",
                kind: "image",
                label: "Cyberpunk alleyway",
                assets: [
                  {
                    assetId: "asset-1",
                    type: "image",
                    url: "https://cdn.example.com/alley.png",
                    name: "alley.png",
                  },
                ],
              }),
            },
          },
        ],
      },
    ]

    const activity = extractRunActivity("run-3", messages)

    expect(activity.mediaRequests).toEqual([
      {
        id: "job-101",
        toolCallId: "tc-gen-1",
        jobId: "job-101",
        kind: "image",
        label: "Cyberpunk alleyway",
        modelId: "flux-pro",
        parameters: { prompt: "Neon lit cyberpunk alley" },
        status: "completed",
        assets: [
          {
            id: "asset-1",
            name: "alley.png",
            url: "https://cdn.example.com/alley.png",
            type: "image",
          },
        ],
        error: null,
      },
    ])
  })

  it("returns null from extractLatestRunActivity when the latest run has no file or media changes", () => {
    const runs: Array<AgentRunBlock> = [
      {
        id: "run-1",
        projectId: "proj-1",
        conversationId: "conv-1",
        status: "finished",
        messages: [
          {
            id: "asst-1",
            createdAt: "2026-11-08T10:00:00.000Z",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
          },
        ],
        metadata: {},
        error: null,
        createdAt: "2026-11-08T10:00:00.000Z",
        updatedAt: "2026-11-08T10:00:05.000Z",
      },
    ]

    expect(extractLatestRunActivity(runs)).toBeNull()
  })
})

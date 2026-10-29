import { describe, expect, it } from "vitest"
import {
  extractLatestActiveAskQuestions,
  formatQuestionAnswersMessage,
  parseAskQuestionsInput,
} from "./ask-questions"
import type { AgentRunBlock } from "../types"

describe("ask-questions helpers", () => {
  it("parses valid askQuestions tool input and caps at 4 questions", () => {
    const parsed = parseAskQuestionsInput({
      questions: [
        {
          id: "aspect_ratio",
          question: "Which aspect ratio do you want?",
          options: ["9:16 Vertical", "16:9 Widescreen"],
        },
        {
          id: "tone",
          question: "What tone should the narrator use?",
          options: ["Cinematic & dramatic", "Upbeat & conversational"],
        },
      ],
    })

    expect(parsed).toEqual([
      {
        id: "aspect_ratio",
        question: "Which aspect ratio do you want?",
        options: ["9:16 Vertical", "16:9 Widescreen"],
      },
      {
        id: "tone",
        question: "What tone should the narrator use?",
        options: ["Cinematic & dramatic", "Upbeat & conversational"],
      },
    ])
  })

  it("extracts active askQuestions only when latest run is finished and has askQuestions tool call", () => {
    const run: AgentRunBlock = {
      id: "run-1",
      projectId: "proj-1",
      conversationId: "conv-1",
      status: "finished",
      error: null,
      metadata: {},
      createdAt: "2026-10-29T00:00:00.000Z",
      updatedAt: "2026-10-29T00:00:05.000Z",
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          createdAt: "2026-10-29T00:00:01.000Z",
          content: [
            {
              type: "tool-call",
              toolCallId: "tc-ask-1",
              toolName: "askQuestions",
              isStreaming: false,
              input: {
                questions: [
                  {
                    id: "style",
                    question: "Which visual style?",
                    options: ["Noir", "Anime"],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    expect(extractLatestActiveAskQuestions([run])).toEqual({
      runId: "run-1",
      toolCallId: "tc-ask-1",
      questions: [
        {
          id: "style",
          question: "Which visual style?",
          options: ["Noir", "Anime"],
        },
      ],
    })

    // If a subsequent run exists without askQuestions, returns null
    const followUpRun: AgentRunBlock = {
      ...run,
      id: "run-2",
      messages: [],
    }
    expect(extractLatestActiveAskQuestions([run, followUpRun])).toBeNull()
  })

  it("formats options, custom answers, and skipped questions cleanly", () => {
    const questions = [
      {
        id: "q1",
        question: "Which aspect ratio?",
        options: ["9:16", "16:9"] as [string, string],
      },
      {
        id: "q2",
        question: "Visual style?",
        options: ["Realistic", "Stylized"] as [string, string],
      },
      {
        id: "q3",
        question: "Background music?",
        options: ["Synthwave", "Orchestral"] as [string, string],
      },
    ]

    const formatted = formatQuestionAnswersMessage(questions, {
      q1: { kind: "option", value: "9:16" },
      q2: { kind: "custom", value: "Stop-motion claymation" },
      q3: { kind: "skipped" },
    })

    expect(formatted).toBe(
      [
        "- **Which aspect ratio?**: 9:16",
        "- **Visual style?**: Stop-motion claymation",
        "- **Background music?**: Skipped",
      ].join("\n"),
    )
  })
})

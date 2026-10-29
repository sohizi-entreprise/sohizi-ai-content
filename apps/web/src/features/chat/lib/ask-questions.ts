import type { AgentRunBlock, MsgToolCallPart } from "../types"

export const ASK_QUESTIONS_TOOL_NAME = "askQuestions"

export type AgentClarifyingQuestion = {
  id: string
  question: string
  options: [string, string]
}

export type ActiveAskQuestionsPrompt = {
  runId: string
  toolCallId: string
  questions: Array<AgentClarifyingQuestion>
}

export type QuestionAnswerValue =
  | { kind: "option"; value: string }
  | { kind: "custom"; value: string }
  | { kind: "skipped" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function parseAskQuestionsInput(
  input: unknown,
): Array<AgentClarifyingQuestion> {
  if (!isRecord(input) || !Array.isArray(input.questions)) {
    return []
  }

  const parsed: Array<AgentClarifyingQuestion> = []

  input.questions.forEach((raw, index) => {
    if (!isRecord(raw)) return
    const questionText =
      typeof raw.question === "string" ? raw.question.trim() : ""
    if (!questionText) return

    const rawOptions = Array.isArray(raw.options)
      ? raw.options
          .filter((opt): opt is string => typeof opt === "string")
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
      : []

    if (rawOptions.length < 2) return

    const id =
      typeof raw.id === "string" && raw.id.trim().length > 0
        ? raw.id.trim()
        : `question_${index + 1}`

    parsed.push({
      id,
      question: questionText,
      options: [rawOptions[0], rawOptions[1]],
    })
  })

  return parsed.slice(0, 4)
}

export function extractAskQuestionsFromMessages(
  runId: string,
  messages: Array<AgentRunBlock["messages"][number]>,
): ActiveAskQuestionsPrompt | null {
  let matchedToolCall: MsgToolCallPart | null = null

  for (const message of messages) {
    if (message.role !== "assistant") continue
    for (const part of message.content) {
      if (
        part.type === "tool-call" &&
        part.toolName === ASK_QUESTIONS_TOOL_NAME &&
        !part.isStreaming
      ) {
        matchedToolCall = part
      }
    }
  }

  if (!matchedToolCall) return null

  const questions = parseAskQuestionsInput(matchedToolCall.input)
  if (questions.length === 0) return null

  return {
    runId,
    toolCallId: matchedToolCall.toolCallId,
    questions,
  }
}

export function extractLatestActiveAskQuestions(
  runs: Array<AgentRunBlock>,
): ActiveAskQuestionsPrompt | null {
  if (runs.length === 0) return null

  const latestRun = runs[runs.length - 1]
  if (latestRun.status !== "finished") return null

  return extractAskQuestionsFromMessages(latestRun.id, latestRun.messages)
}

export function formatQuestionAnswersMessage(
  questions: Array<AgentClarifyingQuestion>,
  answersByQuestionId: Record<string, QuestionAnswerValue | undefined>,
): string {
  const lines = questions.map((q) => {
    const answer = answersByQuestionId[q.id]
    if (!answer || answer.kind === "skipped") {
      return `- **${q.question}**: Skipped`
    }
    const trimmed = answer.value.trim()
    if (!trimmed) {
      return `- **${q.question}**: Skipped`
    }
    return `- **${q.question}**: ${trimmed}`
  })

  return lines.join("\n")
}

import { z } from "zod"
import { ModelMessage, UserModelMessage } from "ai"
import { LlmChunk, streamEvents } from "../utils/llm-response"
import { BillableLlmInput } from "../utils/llm-client"
import { TokenUsage } from "@/type"
import { estimateInputTokens } from "../utils/estimate-token"
import { extractTextFromUserMessage } from "../utils/message-content"

export const stopEvaluationSchema = z.object({
  isDone: z
    .boolean()
    .describe(
      "True if the agent message is a final response. False if it is an intermediate progress/intent statement.",
    ),
  instruction: z
    .string()
    .describe(
      "When isDone is false, provide a concise instruction telling the agent to proceed with the action it described. When isDone is true, this can be empty.",
    ),
})

export type StopEvaluation = z.infer<typeof stopEvaluationSchema>

const EVALUATOR_SYSTEM_PROMPT = `You are a stop-condition evaluator for an AI agent execution loop.

The agent operates in a tool-calling loop. Sometimes it emits text WITHOUT calling a tool. Your job: decide whether the agent is handing control back to the user (done) or failed to follow through on a self-directed action (not done).

## isDone = true (the agent is DONE) — any of these:
- Summarizes completed work ("I've updated the timeline", "Done — here's the result")
- Asks the user a question or presents options ("Would you like me to…?", "Which option do you prefer?", "Let me know if you'd like to…")
- States it is blocked or cannot proceed ("I can't find that file", "This requires access I don't have")
- Delivers a final answer, explanation, or creative output
- Offers next steps for the USER to choose from ("If you want, I can: A, B, or C")

## isDone = false (the agent is NOT done) — all of these must be true:
- The message describes an action the agent itself intends to take NOW, autonomously, without waiting for user input
- Examples: "I'll now read the file…", "Let me update the timeline…", "Next I need to check the assets…"
- The message does NOT ask the user anything or present choices

## Critical rule: when in doubt, set isDone to true. A false positive (stopping too early) is far less harmful than a false negative (infinite loop).`

export const DEFAULT_EVALUATOR_OUTPUT_TOKENS = 256

type EvaluatorInput = {
  lastAssistantText: string
  userMessage: UserModelMessage
}

export function buildEvaluatorInput(input: EvaluatorInput): BillableLlmInput {
  const { lastAssistantText, userMessage } = input
  const userText = extractTextFromUserMessage(userMessage)

  const evaluatorMessages: ModelMessage[] = [
    { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Original user request:\n\n"${userText}"\n---\nHere is the agent's last message (no tool calls were made in this step):\n\n"${lastAssistantText}"\n---\nDetermine if this is a final response or an intermediate message.`,
        },
      ],
    },
  ]

  return {
    messages: evaluatorMessages,
    outputSchema: stopEvaluationSchema,
    stream: false,
    estimatedInputTokens: estimateInputTokens(evaluatorMessages, 1.15),
    estimatedOutputTokens: DEFAULT_EVALUATOR_OUTPUT_TOKENS,
  }
}

export function parseEvaluatorResponse(text: string): StopEvaluation {
  try {
    const parsed = JSON.parse(text)
    return stopEvaluationSchema.parse(parsed)
  } catch {
    return { isDone: true, instruction: "" }
  }
}

export async function drainStreamForComplete(
  stream: AsyncGenerator<LlmChunk, void, unknown>,
): Promise<{ text: string; usage: TokenUsage } | null> {
  let result: { text: string; usage: TokenUsage } | null = null
  for await (const chunk of stream) {
    if (chunk.type === streamEvents.complete) {
      result = { text: chunk.text, usage: chunk.usage }
    }
  }
  return result
}

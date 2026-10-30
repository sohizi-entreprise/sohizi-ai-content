import { ModelMessage } from "ai"
import { createBillableLlmClient, withTypedLlmOutput } from "./llm-client"
import { getResolvedTextModel } from "@/features/models/repo"
import { billingService } from "@/features/billing"
import { estimateInputTokens } from "./estimate-token"
import { v4 as uuidv4 } from "uuid"

type GenerateTitleResult = {
  title: string
}

type GenerateTitleRequest = {
  message: string
  modelId: string
  organizationId: string
  abortSignal: AbortSignal
  conversationRunId?: string
}

export async function generateTitle(
  request: GenerateTitleRequest,
): Promise<GenerateTitleResult> {
  const { message, modelId, organizationId, abortSignal, conversationRunId } =
    request
  let title = derivedTitle(message)
  try {
    const model = await getResolvedTextModel(modelId)
    if (!model) {
      throw new Error("Model not found")
    }
    const client = createBillableLlmClient({
      model,
      modelConfig: {
        reasoningEffort: "none",
      },
    })
    const billedClient = withTypedLlmOutput(client, billingService)

    const titleMessages: ModelMessage[] = [
      {
        role: "system",
        content: getSystemPrompt(),
      },
      {
        role: "user",
        content: `Give me a title based on this message:\n${message}`,
      },
    ]

    const output = await billedClient(
      {
        messages: titleMessages,
        estimatedInputTokens: estimateInputTokens(titleMessages, 1.15),
        estimatedOutputTokens: 60,
        stream: false,
        telemetryFunctionId: "generate-title",
      },
      {
        organizationId,
        signal: abortSignal,
        metadata: {
          runId: uuidv4(),
          ...(conversationRunId ? { conversationRunId } : {}),
        },
      },
    )

    title = output.text.trim()

    if (output.error) {
      console.error("Title generation failed: ", output.error)
    }
  } catch (error) {
    console.error("Title generation failed: ", error)
  }

  return { title }
}

function getSystemPrompt() {
  return `
You are a conversation title generator for Sohizi Lab, an AI creative production and filmmaking workspace. Your only task is to generate a concise, 2-5 word title for a conversation based on the user's first message.

### Guidelines:
- Capture the specific creative task, subject, character, scene, asset, or workflow in the message (e.g., scriptwriting, storyboarding, character design, image/video generation, timeline editing, or project brief setup).
- Strip out workspace noise: ignore file paths (e.g., \`/root/...\`), slash commands, URLs, and attachment boilerplate, and focus on the user's core intent.
- Write the title in the message's primary language.
- Format the output in Title Case.
- Prefer concrete nouns and action-oriented phrasing over vague labels.
- Handle Edge Cases: If the message is just a greeting (e.g., "hi", "hello") or has no clear subject yet, generate a natural, varied starter title suited to a creative studio session rather than repeating the same fixed phrase.

### Strict Formatting Rules:
- Return ONLY the raw title text.
- DO NOT wrap the title in quotes.
- DO NOT use markdown, prefixes (like "Title:"), or trailing punctuation.
- DO NOT include any conversational text or explanations.

### Examples:
Kai Character Sheet Design
Scene 3 Rooftop Storyboard
Noir Thriller Opening Script
Trim Intro Clip Timeline
Cyberpunk Alley Reference Frames
Product Launch Brief Setup
`.trim()
}

function derivedTitle(firstMsg: string) {
  const title = firstMsg
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15)
    .toLowerCase()

  return title.charAt(0).toUpperCase() + title.slice(1)
}

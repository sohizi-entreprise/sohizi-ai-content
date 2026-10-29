import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { success } from "./utils"

export const ASK_QUESTIONS_TOOL_NAME = "askQuestions"

const questionSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      "Short unique identifier for the question, e.g. 'aspect_ratio' or 'visual_style'",
    ),
  question: z
    .string()
    .min(1)
    .describe("Concise, direct clarifying question for the user"),
  options: z
    .array(z.string().min(1))
    .min(2)
    .max(2)
    .describe(
      "Exactly 2 distinct predefined options for the user to choose from. The UI automatically provides a 3rd open-ended input for custom answers.",
    ),
})

export const askQuestionsInputSchema = z.object({
  questions: z
    .array(questionSchema)
    .min(1)
    .max(4)
    .describe("1 to 4 clarifying questions to present to the user"),
})

export type AskQuestionsInput = z.infer<typeof askQuestionsInputSchema>

export const askQuestionsTool = buildBaseTool({
  name: ASK_QUESTIONS_TOOL_NAME,
  description:
    "Ask the user 1 to 4 structured clarifying questions before proceeding. Each question must include exactly 2 predefined options (the UI automatically provides an open-ended custom input and a skip button). Calling this tool immediately pauses the current turn and waits for the user's answers. Use ONLY when explicitly asked to plan something, when brainstorming, or before media generation when the request is genuinely ambiguous.",
  inputSchema: askQuestionsInputSchema,
  execute: async (_input, { state }) => {
    state.pauseRun()
    return success(
      "Questions presented to the user. Wait for the user's response in the next turn.",
    )
  },
})

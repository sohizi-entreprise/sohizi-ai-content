import { parse } from "partial-json"
import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { success } from "./utils"

export const PROVIDE_STATUS_UPDATE_TOOL_NAME = "provideStatusUpdate"

const provideStatusUpdateInputSchema = z.object({
  message: z
    .string()
    .describe(
      "1-2 short sentences updating the user on what you are doing. Not a result, not a question, not a plan dump.",
    ),
})

export const provideStatusUpdateTool = buildBaseTool({
  name: PROVIDE_STATUS_UPDATE_TOOL_NAME,
  description:
    "Use this tool to display a progress update to the user while you work. Use BEFORE meaningful tool calls to state what you will do, and AFTER learning something important to summarize findings and state the next action.",
  inputSchema: provideStatusUpdateInputSchema,
  execute: async () => {
    return success(
      "The user has been updated on your progress. Continue working.",
    )
  },
})

export function extractStatusUpdateMessage(input: unknown): string | null {
  if (typeof input === "object" && input !== null && "message" in input) {
    const message = (input as { message: unknown }).message
    return typeof message === "string" ? message : null
  }

  if (typeof input !== "string" || input.length === 0) {
    return null
  }

  try {
    const parsed = parse(input) as { message?: unknown }
    return typeof parsed.message === "string" ? parsed.message : null
  } catch {
    return null
  }
}

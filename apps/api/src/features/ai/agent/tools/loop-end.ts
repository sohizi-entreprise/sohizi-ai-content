import { buildBaseTool } from "./tool-definition"
import { z } from "zod"
import { success } from "./utils"

const endExecutionLoopSchema = z.object({
  reason: z
    .enum(["done", "question", "blocked"])
    .describe(
      'The reason for ending the execution loop. "done" means you solved the user\'s request successfully.  "question" means you needs clarification or confirmation from the user. "blocked" means you could not proceed because of a blocker.',
    ),
})

export const endExecutionLoopTool = buildBaseTool({
  name: "endExecutionLoop",
  description:
    "Call this tool to signal that the user's request is completely fulfilled, permanently blocked or needs clarification/confirmation, and the execution loop should end. CRITICAL: You MUST call this tool exactly once at the end of your execution loop after you have provided your final response to the user.",
  inputSchema: endExecutionLoopSchema,
  execute: async (_, { state }) => {
    state.finishRun()
    return success("The execution loop has ended.")
  },
})

export const finishTool = buildBaseTool({
  name: "finish",
  description:
    "Call this tool to signal that the user's request is completely fulfilled, permanently blocked or needs clarification/confirmation, and the execution loop should end. CRITICAL: You MUST call this tool exactly once. Do not call this if any subtask is unresolved.",
  inputSchema: z.object({
    reason: z
      .enum(["done", "question", "blocked"])
      .describe(
        'The reason for calling this tool. "done" means you solved the user\'s request successfully.  "question" means you needs clarification or confirmation from the user. "blocked" means you could not proceed because of a blocker.',
      ),
    message: z
      .string()
      .describe(
        "A super concise message to the user. If blocked, explain why. If question, ask for clarification. If done, summarize the result.",
      ),
  }),
  execute: async (_, { state }) => {
    state.finishRun()
    return success("The user is been notified of the result.")
  },
})

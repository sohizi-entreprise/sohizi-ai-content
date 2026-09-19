import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { supportedAgents } from "../constants"
import { success, failure } from "./utils"
import { getErrorMessage } from "@/utils/get-error-message"
import { streamEvents } from "../utils/llm-response"
import { withSubAgentObservation } from "../utils/tracing"
import { writeStreamData } from "@/features/generation-request/stream-handler"

const assignTaskInputSchema = z.object({
  subAgent: z
    .enum(supportedAgents)
    .describe("The specific type of sub-agent required for the job."),
  instructions: z
    .string()
    .describe(
      "The instructions for the sub-agent to follow in order to complete the assigned task.",
    ),
})

export const assignTaskTool = buildBaseTool({
  name: "assignTask",
  description:
    "Delegates a focused, heavy-lifting task to a specialized sub-agent.",
  inputSchema: assignTaskInputSchema,
  execute: async (input, { session, abortSignal, toolCallId, runId }) => {
    const { subAgent, instructions } = input

    try {
      // Lazy import avoids circular init: tasks-assign → agent-factory → agent → tool-registry → tasks-assign
      const { createAgentFromDefinition } =
        await import("../core/agent-factory")
      const { getAgentDefinition } = await import("../core/agent-registry")
      const agentDefinition = getAgentDefinition(subAgent)
      if (!agentDefinition) {
        return failure(
          `Invalid sub-agent name provided. Supported are ${supportedAgents.join(", ")}`,
        )
      }

      const model = await session.resolveModel(
        agentDefinition.modelId,
        agentDefinition.vendor,
      )
      if (!model) {
        return failure(
          `Model not found. The sub-agent ${subAgent} is unvailable right now. Either assign a different sub-agent if possible or return to the user if this is a blocker.`,
        )
      }

      const agent = await createAgentFromDefinition({
        agentName: subAgent,
        session,
        model,
      })

      const msg = {
        role: "user" as const,
        content: instructions,
      }

      const output = await withSubAgentObservation(
        subAgent,
        instructions,
        async () => {
          const chunks = agent.runLoop(msg, abortSignal, 100)
          let text = ""

          for await (const chunk of chunks) {
            if (chunk.type === streamEvents.textDelta) {
              text = chunk.text
            } else if (
              chunk.type === streamEvents.toolCall ||
              chunk.type === streamEvents.toolCallStart ||
              chunk.type === streamEvents.toolCallEnd
            ) {
              const subAgentChunk = {
                ...chunk,
                source: "subAgent",
                toolCallId,
                runId,
              }
              await writeStreamData(session.runId, {
                runId: session.runId,
                event: "chunk",
                source: "subAgent",
                chunk: subAgentChunk,
              })
            }
          }
          return text
        },
      )

      return success(output)
    } catch (error) {
      console.error(error)
      return failure(getErrorMessage(error, "An unknown error occurred"))
    }
  },
})

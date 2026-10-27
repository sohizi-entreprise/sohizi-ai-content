import modelsTracker from "@/catalog/models-tracker"
import {
  recall_memory,
  saveMemory as storeMemory,
} from "@/features/memory/service"
import { z } from "zod"
import { buildBaseTool, ToolExecutionOptions } from "./tool-definition"
import { failure, success } from "./utils"

const scopeSchema = z
  .enum(["project", "user", "user-project"])
  .describe(
    "project: shared on this project. user: this user across projects. user-project: this user on this project.",
  )

const loadingPolicySchema = z
  .enum(["always", "on-demand"])
  .describe(
    "always: include on every recall. on-demand: include only when it matches the request.",
  )

async function memoryModel(session: ToolExecutionOptions["session"]) {
  return session.resolveModel(modelsTracker.memory)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatMemories(
  tag: string,
  memories: { content: string; whenCreated: string }[],
) {
  const items = memories
    .map(
      (memory) =>
        `<memory created="${escapeXml(memory.whenCreated)}">${escapeXml(memory.content)}</memory>`,
    )
    .join("\n")
  return `<${tag}>${items ? `\n${items}\n` : ""}</${tag}>`
}

export const recallMemoryTool = buildBaseTool({
  name: "recallMemory",
  description:
    "Load stored user and project memories that would change the answer. Pass what you need to match. Returns always-loaded memories and any memories selected for this prompt.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe("What to match against stored memories for this request."),
  }),
  execute: async ({ prompt }, { session, abortSignal, runId }) => {
    const model = await memoryModel(session)
    if (!model) return failure("Memory is unavailable right now.")

    const { hotMemories, recalledMemories } = await recall_memory({
      userId: session.userId,
      projectId: session.projectId,
      model,
      organizationId: session.organizationId,
      abortSignal,
      runId,
      prompt,
    })

    return success(
      [
        formatMemories("always_loaded", hotMemories),
        formatMemories("relevant", recalledMemories),
      ].join("\n\n"),
    )
  },
})

export const saveMemoryTool = buildBaseTool({
  name: "saveMemory",
  description:
    "Save important facts you learned about the user or project so you can recall them later.",
  inputSchema: z.object({
    content: z.string().describe("1-2 factual sentences to remember."),
    scope: scopeSchema,
    loadingPolicy: loadingPolicySchema,
  }),
  execute: async (
    { content, scope, loadingPolicy },
    { session, abortSignal, runId },
  ) => {
    const model = await memoryModel(session)
    if (!model) return failure("Memory is unavailable right now.")

    const result = await storeMemory({
      userId: session.userId,
      projectId: session.projectId,
      model,
      memoryPayload: { scope, content, loadingPolicy },
      organizationId: session.organizationId,
      abortSignal,
      runId,
    })

    if (!result.saved)
      return failure(
        "Could not save this memory. Memory is unavailable. Do not report this error to the user.",
      )
    return success("Saved.")
  },
})

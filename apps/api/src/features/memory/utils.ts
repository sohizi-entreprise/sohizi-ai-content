import modelsTracker from "@/catalog/models-tracker"
import { estimateInputTokens } from "../ai/agent/utils/estimate-token"
import {
  createBillableLlmClient,
  withTypedLlmOutput,
} from "../ai/agent/utils/llm-client"
import { billingService } from "../billing"
import { ResolvedTextModel } from "../models/repo"
import { z } from "zod"

type CallModelParameters<T extends z.ZodType> = {
  model: ResolvedTextModel
  sysPrompt: string
  prompt: string
  options: { syntheticId: string; content: string }[]
  organizationId: string
  abortSignal?: AbortSignal
  runId: string
  schema: T
}

export type PickParameters<T extends z.ZodType> = Omit<
  CallModelParameters<T>,
  "schema" | "options"
> & { memories: { id: string; content: string; whenCreated: string }[] }

const answerSchema = z.object({
  memoryIds: z.array(z.string()),
})

const checkMemorySchema = z.object({
  action: z.enum(["append", "replace"]),
  content: z.string(),
  memoryId: z.string().nullable().default(null),
})

export const pickMemories = async (
  payload: PickParameters<typeof checkMemorySchema>,
) => {
  const {
    model,
    sysPrompt,
    prompt,
    memories,
    organizationId,
    abortSignal,
    runId,
  } = payload
  const choices = memories.map((data, index) => ({
    ...data,
    syntheticId: String(index),
  }))

  const result = await callMemoryModel({
    model,
    sysPrompt,
    prompt,
    options: choices,
    organizationId,
    abortSignal,
    runId,
    schema: answerSchema,
  })

  if (!result.output) {
    return { memories: [] }
  }

  const memoryIds = new Set(result.output.memoryIds)
  const selectedMemories = choices
    .filter((choice) => memoryIds.has(choice.syntheticId))
    .map(({ syntheticId: _, ...rest }) => ({ ...rest }))

  return { memories: selectedMemories }
}

export const checkMemoryUpdates = async ({
  model,
  sysPrompt,
  prompt,
  memories,
  organizationId,
  abortSignal,
  runId,
}: PickParameters<typeof checkMemorySchema>) => {
  const options = memories.map((data, index) => ({
    ...data,
    syntheticId: String(index),
  }))

  const result = await callMemoryModel({
    model,
    sysPrompt,
    prompt,
    options,
    organizationId,
    abortSignal,
    runId,
    schema: checkMemorySchema,
  })

  if (!result.output) {
    return null
  }

  const { action, content, memoryId: syntheticId } = result.output
  const selectedMemory = options.find(
    (option) => option.syntheticId === syntheticId,
  )

  const memoryId = selectedMemory?.id ?? null

  return {
    action,
    content,
    memoryId,
  }
}

async function callMemoryModel<T extends z.ZodType>({
  model,
  sysPrompt,
  prompt,
  options,
  organizationId,
  abortSignal,
  runId,
  schema,
}: CallModelParameters<T>): Promise<{ output: z.core.output<T> | null }> {
  const billableLlmClient = createBillableLlmClient({
    model,
    modelConfig: {
      reasoningEffort: "low",
      gatewayModels: [modelsTracker.memoryFallback],
    },
  })
  const billed = withTypedLlmOutput(billableLlmClient, billingService)

  const messages = [
    {
      role: "system" as const,
      content: sysPrompt,
    },
    {
      role: "user" as const,
      content: buildRecallUserPrompt(prompt, options),
    },
  ]

  const result = await billed(
    {
      messages,
      outputSchema: schema,
      stream: false,
      estimatedInputTokens: estimateInputTokens(messages, 1.15),
      estimatedOutputTokens: 256,
    },
    {
      organizationId,
      signal: abortSignal,
      metadata: { runId },
    },
  )

  if (!result.output) {
    if (result.error) console.error(result.error)
    return { output: null }
  }

  return { output: result.output }
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatTimeAgo(createdAt: Date, now = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - createdAt.getTime())
  if (elapsedMs < MINUTE_MS) return "few seconds ago"

  if (elapsedMs < HOUR_MS) {
    const minutes = Math.floor(elapsedMs / MINUTE_MS)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
  }

  if (elapsedMs < DAY_MS) {
    const hours = Math.floor(elapsedMs / HOUR_MS)
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  }

  const days = Math.floor(elapsedMs / DAY_MS)
  return `${days} ${days === 1 ? "day" : "days"} ago`
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function buildRecallUserPrompt(
  prompt: string,
  choices: { content: string; syntheticId: string }[],
): string {
  const request = singleLine(prompt)
  const saved = choices
    .map((item) => {
      const id = singleLine(item.syntheticId)
      const text = singleLine(item.content)
      if (!id || !text) return null
      return `- id: ${id}\n  text: ${text}`
    })
    .filter((line) => line !== null)
    .join("\n")

  const memoriesBlock = saved.length > 0 ? `\n${saved}\n` : "\n"
  return `<user_request>\n${request}\n</user_request>\n\n<saved_memories>${memoriesBlock}</saved_memories>`
}

import { MemoryLoadingPolicy, MemoryScope } from "@/type"
import { ResolvedTextModel } from "../models/repo"
import { recallPrompt, saveMemoryPrompt } from "./prompts"
import {
  appendMemory,
  listMemories,
  updateLastUsedAt,
  updateMemory,
} from "./repo"
import { formatTimeAgo, pickMemories, checkMemoryUpdates } from "./utils"

const DEFAULT_MAX_RECORDS = 200

type RecallMemoryParams = {
  userId: string
  projectId: string
  model: ResolvedTextModel
  prompt: string
  organizationId: string
  abortSignal?: AbortSignal
  runId: string
}

type SaveMemoryParams = {
  userId: string
  projectId: string
  model: ResolvedTextModel
  memoryPayload: {
    scope: MemoryScope
    content: string
    loadingPolicy: MemoryLoadingPolicy
  }
  organizationId: string
  abortSignal?: AbortSignal
  runId: string
}

type ReturnedMemory = {
  id: string
  content: string
  whenCreated: string
}

export const recall_memory = async ({
  userId,
  projectId,
  model,
  organizationId,
  abortSignal,
  runId,
  prompt,
}: RecallMemoryParams) => {
  const allMemories = await listMemories({ userId, projectId })
  if (allMemories.length === 0) {
    return { hotMemories: [], recalledMemories: [] }
  }
  // hotMemories are the memories that are always loaded
  const hotMemories: ReturnedMemory[] = []
  const coldMemories: ReturnedMemory[] = []

  for (const memory of allMemories) {
    const mem = {
      id: memory.id,
      content: memory.content,
      whenCreated: formatTimeAgo(memory.createdAt),
    }
    if (memory.loadingPolicy === "always") {
      hotMemories.push(mem)
    } else {
      coldMemories.push(mem)
    }
  }

  const recalledMemories =
    coldMemories.length === 0
      ? []
      : (
          await pickMemories({
            model,
            prompt,
            sysPrompt: recallPrompt,
            memories: coldMemories,
            organizationId,
            abortSignal,
            runId,
          })
        ).memories

  await updateLastUsedAt({
    ids: [...hotMemories, ...recalledMemories].map((memory) => memory.id),
    userId,
    projectId,
  })

  return { hotMemories, recalledMemories }
}

export const saveMemory = async ({
  userId,
  projectId,
  model,
  memoryPayload: { scope, content, loadingPolicy },
  organizationId,
  abortSignal,
  runId,
}: SaveMemoryParams) => {
  const incoming = content.trim()
  if (!incoming) {
    return { failed: true, saved: false }
  }

  const allMemories = await listMemories({ userId, projectId })
  if (allMemories.length === 0) {
    await appendMemory({
      userId,
      projectId,
      content: incoming,
      scope,
      loadingPolicy,
      maxRecords: DEFAULT_MAX_RECORDS,
    })
    return { failed: false, saved: true }
  }

  const memories = allMemories.map((memory) => ({
    id: memory.id,
    content: memory.content,
    whenCreated: formatTimeAgo(memory.createdAt),
  }))

  const operation = await checkMemoryUpdates({
    model,
    prompt: incoming,
    sysPrompt: saveMemoryPrompt,
    memories,
    organizationId,
    abortSignal,
    runId,
  })

  if (!operation) {
    return { failed: true, saved: false }
  }

  const storedContent = operation.content.trim() || incoming

  if (operation.action === "append") {
    await appendMemory({
      userId,
      projectId,
      content: storedContent,
      scope,
      loadingPolicy,
      maxRecords: DEFAULT_MAX_RECORDS,
    })
    return { failed: false, saved: true }
  }
  if (!operation.memoryId) {
    return { failed: true, saved: false }
  }

  const updated = await updateMemory({
    id: operation.memoryId,
    userId,
    projectId,
    content: storedContent,
    scope,
    loadingPolicy,
  })
  if (!updated) {
    return { failed: true, saved: false }
  }
  return { failed: false, saved: true }
}

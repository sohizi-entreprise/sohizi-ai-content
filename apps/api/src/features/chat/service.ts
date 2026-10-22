import { CursorPaginationOptions } from "@/type"
import * as repo from "./repo"
import { z } from "zod"
import { UserModelMessage, userModelMessageSchema } from "ai"
import { assertConversationOwner } from "@/lib/authorize"
import { Conversation, ConversationAgentRun } from "@/db/schema"
import {
  getModelReasoningEffort,
  getResolvedTextModel,
  type ModelReasoningEffort,
  type ResolvedTextModel,
} from "@/features/models/repo"
import type { ReasoningEffort } from "../ai/agent/utils/llm-client"
import { BadRequest } from "../error"
import { Session } from "../ai/agent/core/session"
import { v4 as uuidv4 } from "uuid"
import { CheckpointPersistence } from "../ai/agent/core/persistence"
import { createAgentFromDefinition } from "../ai/agent/core/agent-factory"
import {
  getAgentDefinition,
  type AgentName,
} from "../ai/agent/core/agent-registry"
import { generateTitle } from "../ai/agent/utils/generate-title"
import {
  broadcastCancellation,
  createCancellableController,
} from "../generation-request/abort-manager"
import {
  markStreamActive,
  removeStreamActive,
  streamChunksAsSse,
  writeStreamData,
} from "../generation-request/stream-handler"
import { getProjectBrief, getProjectById } from "../project/repo"
import { buildCommandPrompt, getCommands } from "@/catalog/commands"
import { buildProjectSettingsPrompt, getPresets } from "@/catalog/presets"
import { getErrorMessage } from "@/utils/get-error-message"
import { listSkills } from "../file-system/repo"
import * as commandService from "../command/service"
import {
  buildInvokedCommandsPrompt,
  extractCommandNames,
} from "../command/resolve"
import {
  buildEditorContextPrompt,
  editorContextSchema,
  type EditorContext,
} from "./editor-context"
import { durableSystemMessage } from "../ai/agent/core/system-persist"
import { extractTextFromUserMessage } from "../ai/agent/utils/message-content"
import { textFromAgentChunk, withAgentTrace } from "../ai/agent/utils/tracing"

export const listConversations = async (
  projectId: string,
  userId: string,
  options?: CursorPaginationOptions,
) => {
  const conversations = await repo.listConversations(projectId, userId, options)
  return conversations
}

export const listMessages = async (
  conversationId: string,
  options?: CursorPaginationOptions,
) => {
  const messages = await repo.ListMessagesByConversationId(
    conversationId,
    options,
  )
  return messages
}

export const deleteConversation = async (id: string) => {
  const result = await repo.deleteConversation(id)
  return { ok: result, error: result ? null : "Failed to delete conversation" }
}

export { listLlmModels, listModelParameters } from "../models/service"

export const listConversationAgentRuns = async (
  conversationId: string,
  options?: CursorPaginationOptions,
) => {
  const agentRuns = await repo.listConversationAgentRuns(
    conversationId,
    options,
  )
  return agentRuns
}

export const completionSchema = z.object({
  conversationId: z.uuid("Invalid conversation id").nullable(),
  modelId: z.string("Invalid model id"),
  reasoningEffort: z.string().optional(),
  userPrompt: userModelMessageSchema,
  editorContext: editorContextSchema.optional(),
})

export const cancelRun = async (runId: string) => {
  try {
    await broadcastCancellation(runId)
    await repo.updateConversationAgentRun(runId, { status: "finished" })
    await removeStreamActive(runId)
    return { ok: true, error: null }
  } catch (error) {
    console.error(error)
    return { ok: false, error: getErrorMessage(error, "Failed to cancel run") }
  }
}

export async function* getStreams(runId: string) {
  yield* streamChunksAsSse(runId)
}

type CompletionPayload = z.infer<typeof completionSchema>

export const chatCompletion = async (
  userId: string,
  projectId: string,
  payload: CompletionPayload,
) => {
  const {
    conversationId,
    modelId,
    userPrompt,
    editorContext,
    reasoningEffort,
  } = payload

  const shouldGenerateTitle = conversationId === null

  const agentDefinition = getAgentDefinition("main-agent")
  if (!agentDefinition) {
    throw new Error("Agent definition not found")
  }
  const model = await getResolvedTextModel(modelId)
  if (!model) {
    throw new BadRequest("Model not found")
  }

  const resolvedReasoningEffort = resolveChatReasoningEffort(
    await getModelReasoningEffort(modelId),
    reasoningEffort,
    agentDefinition.modelConfig.reasoningEffort,
  )

  let result: { conversation: Conversation; run: ConversationAgentRun } | null =
    null
  if (conversationId) {
    await assertConversationOwner(userId, conversationId)
    const conversation = await repo.getConversationById(conversationId)
    const run = await repo.createConversationRun({
      projectId,
      conversationId,
      userMsg: { ...userPrompt, id: uuidv4() },
    })
    result = { conversation, run }
  } else {
    const { conversation, agentRun } = await repo.createConversationComponents({
      projectId,
      userId,
      userMsg: { ...userPrompt, id: uuidv4() },
    })
    result = { conversation, run: agentRun }
  }

  if (!result) {
    throw new BadRequest("Failed to create conversation or run")
  }

  await markStreamActive(result.run.id)

  // Fire and forget the agent run
  runAgent({
    userId,
    conversationId: result.conversation.id,
    projectId,
    model,
    runId: result.run.id,
    userPrompt,
    editorContext,
    shouldGenerateTitle,
    reasoningEffort: resolvedReasoningEffort,
  })

  return result
}

type RunAgentPayload = {
  userId: string
  conversationId: string
  projectId: string
  model: ResolvedTextModel
  runId: string
  userPrompt: UserModelMessage
  editorContext?: EditorContext
  shouldGenerateTitle: boolean
  reasoningEffort?: ReasoningEffort
}

async function runAgent(payload: RunAgentPayload) {
  const {
    userId,
    conversationId,
    projectId,
    model,
    runId,
    userPrompt,
    editorContext,
    shouldGenerateTitle,
    reasoningEffort,
  } = payload
  const { controller, cleanup } = await createCancellableController(runId)

  try {
    await repo.updateConversationAgentRun(runId, { status: "running" })

    const [
      project,
      checkpoint,
      projectSkills,
      userPromptText,
      brief,
      presets,
      commands,
    ] = await Promise.all([
      getProjectById(projectId),
      repo.getCheckpoint(projectId, conversationId),
      listSkills(projectId),
      Promise.resolve(extractTextFromUserMessage(userPrompt)),
      getProjectBrief(projectId),
      getPresets(),
      getCommands(),
    ])
    const projectSettingsPrompt = buildProjectSettingsPrompt(
      presets,
      brief?.additionalSettings,
    )
    const commandPrompt = buildCommandPrompt(
      commands,
      readStoredCommandId(brief?.additionalSettings),
    )

    const invokedCommandNames = extractCommandNames(userPromptText)
    const invokedCommands =
      invokedCommandNames.length > 0
        ? await commandService.resolveCommandsByNames(
            projectId,
            invokedCommandNames,
          )
        : []

    const session = new Session({
      sessionId: uuidv4(),
      userId,
      organizationId: project.organizationId,
      projectId: project.id,
      conversationId: conversationId,
      runId: runId,
    })
    const checkpointPersistence = new CheckpointPersistence(checkpoint, runId)
    const agent = await createAgentFromDefinition({
      agentName: "main-agent",
      session,
      model,
      persistence: checkpointPersistence,
      modelConfig: reasoningEffort ? { reasoningEffort } : undefined,
      buildSystemPrompt: (baseSystemPrompt, definition) =>
        enrichSystemPrompt(
          baseSystemPrompt,
          projectSkills,
          definition.subAgents,
          invokedCommands,
          projectSettingsPrompt,
          commandPrompt,
          // editorContext,
        ),
    })

    await withAgentTrace(
      session,
      {
        agentName: "main-agent",
        entrypoint: "chat",
        input: userPromptText,
      },
      async (updateOutput) => {
        const editorContextPrompt = buildEditorContextPrompt(editorContext)
        const messages = editorContextPrompt
          ? [durableSystemMessage(editorContextPrompt), userPrompt]
          : [userPrompt]
        const chunks = agent.runLoop(messages, controller.signal, 250)
        let outputText = ""

        for await (const chunk of chunks) {
          const text = textFromAgentChunk(chunk)
          if (text !== undefined) {
            outputText = text
          }
          await writeStreamData(runId, { runId, event: "chunk", chunk })
        }

        if (shouldGenerateTitle && !controller.signal.aborted) {
          const conversationTitle = await handleTitleGeneration(
            userPrompt,
            project.organizationId,
            runId,
          )
          await repo.updateConversation(conversationId, {
            title: conversationTitle,
          })
        }

        updateOutput(outputText)
      },
    )

    await repo.updateConversationAgentRun(runId, { status: "finished" })
  } catch (error) {
    const errorMessage = getErrorMessage(error, "Completion failed")
    console.error(error)
    await repo.updateConversationAgentRun(runId, {
      status: "error",
      error: errorMessage,
    })
  } finally {
    await writeStreamData(runId, { runId, event: "done" })
    await removeStreamActive(runId)
    await cleanup()
  }
}

async function handleTitleGeneration(
  userPrompt: UserModelMessage,
  organizationId: string,
  conversationRunId: string,
) {
  const { title } = await generateTitle({
    message: extractTextFromUserMessage(userPrompt),
    modelId: "openai/gpt-5-mini",
    organizationId,
    conversationRunId,
    abortSignal: new AbortController().signal, // This won't be aborted since the request will be done at this stage
  })
  return title
}

function readStoredCommandId(
  settings: Record<string, unknown> | null | undefined,
) {
  const commandId = settings?.commandId
  return typeof commandId === "string" && commandId.length > 0
    ? commandId
    : null
}

function enrichSystemPrompt(
  systemPrompt: string,
  projectSkills: { name: string; description: string; instructions: string }[],
  subAgents: AgentName[],
  invokedCommands: Array<{ name: string; action: string }> = [],
  projectSettingsPrompt = "",
  commandPrompt = "",
  editorContext?: EditorContext,
) {
  let finalPrompt = systemPrompt

  const skillPrompts = projectSkills
    .filter(
      (skill) => !!skill.description.trim() && !!skill.instructions.trim(),
    )
    .map(
      (skill, index) =>
        `${index + 1}. ${skill.name}:\n${skill.description}\n---\n`,
    )
    .join("\n")
  const subAgentDefinitions = subAgents.map((name) => getAgentDefinition(name))
  const subAgentPrompts = subAgentDefinitions
    .filter((subAgent) => !!subAgent)
    .map(
      (subAgent, index) =>
        `${index + 1}. ${subAgent.name}:\n${subAgent.description}\n---\n`,
    )
    .join("\n")
  if (skillPrompts.length > 0) {
    finalPrompt += `
<project-skills>
Here are the skills that you have access to within this project. A skill is a package of instructions, metadata and resources that can give you
specialized capabilities and domain expertise to better perform your tasks. You can load skills "on-demand" depending on the task.

Project Skills (Name + Description):
${skillPrompts}

</project-skills>
`
  }
  if (subAgentPrompts.length > 0) {
    finalPrompt += `
<sub-agents>
Here are the sub-agents that you have access to within this project. A sub-agent is a specialized agent that can perform a specific isolated task.

Sub-Agents (Name + Description):
${subAgentPrompts}
</sub-agents>
`
  }

  const invokedCommandsPrompt = buildInvokedCommandsPrompt(invokedCommands)
  if (invokedCommandsPrompt.length > 0) {
    finalPrompt += `\n\n${invokedCommandsPrompt}`
  }

  if (projectSettingsPrompt.length > 0) {
    finalPrompt += `\n\n${projectSettingsPrompt}`
  }

  if (commandPrompt.length > 0) {
    finalPrompt += `\n\n${commandPrompt}`
  }

  const editorContextPrompt = buildEditorContextPrompt(editorContext)
  if (editorContextPrompt.length > 0) {
    finalPrompt += `\n\n${editorContextPrompt}`
  }

  return finalPrompt.trim()
}

function resolveChatReasoningEffort(
  binding: ModelReasoningEffort | null,
  requested: string | undefined,
  fallback: ReasoningEffort | undefined,
): ReasoningEffort | undefined {
  if (requested) {
    if (!binding?.options.some((option) => option.value === requested)) {
      throw new BadRequest("Invalid reasoning effort for this model")
    }
    return requested as ReasoningEffort
  }

  if (binding?.defaultValue) {
    return binding.defaultValue as ReasoningEffort
  }

  return fallback
}

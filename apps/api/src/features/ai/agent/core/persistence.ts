import { Checkpoint } from "@/db/schema"
import { AgentRunMetadata, AgentState, TokenUsage } from "@/type"
import * as repo from "@/features/chat/repo"
import { ModelMessage } from "ai"
import { messagesForCheckpoint } from "./system-persist"
import { v4 as uuidv4 } from "uuid"

export function agentRunMetadata(
  usage: TokenUsage | null,
  vendor: string | null,
): AgentRunMetadata | undefined {
  if (!usage) return undefined
  return {
    usage,
    ...(vendor ? { vendor } : {}),
  }
}

export abstract class Persistence {
  protected messages: ModelMessage[]

  constructor() {
    this.messages = []
  }

  registerMessage(message: ModelMessage | ModelMessage[]) {
    if (Array.isArray(message)) {
      this.messages.push(...message)
    } else {
      this.messages.push(message)
    }
  }

  abstract persist(
    runtimeState: AgentState,
    vendor: string | null,
    runUsage: TokenUsage | null,
  ): Promise<void>

  abstract getInitialState(): AgentState | null
}

export class CheckpointPersistence extends Persistence {
  private readonly checkpoint: Checkpoint
  private readonly runId: string

  constructor(checkpoint: Checkpoint, runId: string) {
    super()
    this.checkpoint = checkpoint
    this.runId = runId
  }

  async persist(
    runtimeState: AgentState,
    vendor: string | null,
    runUsage: TokenUsage | null,
  ) {
    try {
      await Promise.all([
        this.persistCheckpoint(runtimeState),
        this.persistConversationAgentRun(agentRunMetadata(runUsage, vendor)),
        this.persistConversationUsage(runtimeState),
      ])
    } catch (error) {
      console.error("Failed to persist session state", error)
    } finally {
      this.messages = []
    }
  }

  getInitialState() {
    const state = this.checkpoint.state ?? null
    return state
  }

  async persistCheckpoint(state: AgentState) {
    const conversationId = this.checkpoint.conversationId
    const projectId = this.checkpoint.projectId
    const payload = {
      ...state,
      messages: messagesForCheckpoint(state.messages),
    }
    return await repo.insertCheckpoint(projectId, conversationId, payload)
  }

  async persistConversationAgentRun(metadata: AgentRunMetadata | undefined) {
    const filteredMessages = this.messages.filter(
      (message) => message.role !== "system",
    )
    const messages = filteredMessages.map((message) => ({
      ...message,
      id: uuidv4(),
    }))
    if (filteredMessages.length === 0 && !metadata) return

    await repo.updateConversationAgentRun(this.runId, {
      ...(filteredMessages.length > 0 ? { messages } : {}),
      ...(metadata ? { metadata } : {}),
    })
  }

  async persistConversationUsage(state: AgentState) {
    if (!state.usage) return
    await repo.updateConversation(this.checkpoint.conversationId, {
      metadata: {
        usage: state.usage,
        latestRunUsage: state.latestRunUsage ?? null,
      },
    })
  }
}

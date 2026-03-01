import { z } from 'zod'
import { StreamBus } from '../../stream-bus'

// ============================================================================
// BLOCK TYPES
// ============================================================================

export const blockTypeList = [
  'title',
  'logline',
  'segment',
  'segmentSummary',
  'scene',
  'action',
  'dialogue',
  'character',
  'parenthetical',
  'transition',
  'shot',
  'note',
] as const

export type BlockType = (typeof blockTypeList)[number]

export const BlockTypeSchema = z.enum(blockTypeList)

// ============================================================================
// SCRIPT CONTENT
// ============================================================================

export type ScriptBlock = {
  id: string
  type: BlockType
  parentId: string | null
  content: string
  order: number
}

export type ScriptContent = {
  blocks: ScriptBlock[]
  metadata?: {
    title?: string
    format?: string
  }
}

export type EditComponent = 'script' | 'synopsis' | 'characters' | 'world'

// ============================================================================
// PROJECT INFO
// ============================================================================

export type ProjectInfo = {
  id: string
  format: 'storytime' | 'explainer' | 'screenplay' | 'short'
  genre: string
  tone: string
  audience: string
  maxDuration?: string
  constraints?: Record<string, unknown>
}

// ============================================================================
// AGENT EVENT TYPES
// ============================================================================

export type WriterPhase = 'writing_start' | 'writing_delta' | 'writing_end' | 'reviewing_start' | 'reviewing_delta' | 'reviewing_end'

export type AgentEventType =
  | 'editing_error'
  | 'editing_end'
  | 'editing_start'
  | 'content_editing'

  | 'script_content_editing'
  | 'synopsis_content_editing'
  | 'characters_content_editing'
  | 'world_content_editing'
  | 'progress_update'

export type AgentChunkType =
  | 'reasoning_delta'
  | 'todo'
  | 'status_delta'
  | 'text'
  | WriterPhase

export type AgentEvent = {
  type: AgentEventType
  data: {
    runId: string
    type: AgentChunkType
    content: string
  }
}

export type RunContext = {
  streamBus: StreamBus<AgentEvent>
  eventType: AgentEventType
}

export type ReasoningDeltaEvent = AgentEvent & {
  type: 'reasoning_delta'
  data: { text: string }
}

export type ContentDeltaEvent = AgentEvent & {
  type: 'content_delta'
  data: { text: string }
}

export type ToolCallEvent = AgentEvent & {
  type: 'tool_call'
  data: {
    toolName: string
    toolId: string
    args: unknown
  }
}

export type ToolResultEvent = AgentEvent & {
  type: 'tool_result'
  data: {
    toolName: string
    toolId: string
    result: unknown
    success: boolean
  }
}

export type WriterStartEvent = AgentEvent & {
  type: 'writer_start'
  data: {
    taskId: string
    instruction: string
    skillset: string[]
  }
}

export type WriterProgressEvent = AgentEvent & {
  type: 'writer_progress'
  data: {
    taskId: string
    phase: 'writing' | 'reviewing'
  }
}

export type WriterDeltaEvent = AgentEvent & {
  type: 'writer_delta'
  data: {
    taskId: string
    delta: string
  }
}

export type WriterCompleteEvent = AgentEvent & {
  type: 'writer_complete'
  data: {
    taskId: string
    success: boolean
    content: string
    reviewNotes: string
  }
}

export type SubAgentStartEvent = AgentEvent & {
  type: 'sub_agent_start'
  data: {
    taskId: string
    instruction: string
    skillset: string[]
  }
}

export type SubAgentProgressEvent = AgentEvent & {
  type: 'sub_agent_progress'
  data: {
    taskId: string
    phase: string
    content?: string
  }
}

export type SubAgentCompleteEvent = AgentEvent & {
  type: 'sub_agent_complete'
  data: {
    taskId: string
    success: boolean
    output: unknown
  }
}

export type ErrorEvent = AgentEvent & {
  type: 'error'
  data: {
    message: string
    code?: string
  }
}

export type CompleteEvent = AgentEvent & {
  type: 'complete'
  data: {
    response: string
    tokensUsed?: number
  }
}

// ============================================================================
// AGENT INPUT/OUTPUT
// ============================================================================

export type EditorAgentInput = {
  projectId: string
  conversationId: string
  message: string
  context: {
    blocks?: string[];
    selections?: string[];
  }
}

export type EditorAgentOutput = {
  success: boolean
  response: string
  toolsUsed: string[]
  tokensUsed: number
}

// ============================================================================
// TOOL RESULT TYPES
// ============================================================================

export type LoadSkillResult = {
  skillName: string
  content: string
  loaded: boolean
}

export type ReadContentResult = {
  blocks: ScriptBlock[]
  text: string
}

export type WriteContentResult = {
  success: boolean
  content: string
  reviewNotes: string
}

export type DeleteContentResult = {
  success: boolean
  deletedBlockIds: string[]
}

export type SpawnTaskResult = {
  success: boolean
  output: unknown
  tokensUsed: number
}

export type TodoWriteResult = {
  success: boolean
  tasks: string[]
}

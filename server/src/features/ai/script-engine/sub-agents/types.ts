import type { BlockType, ScriptContent, ProjectInfo, AgentEvent } from '../editor-agent/types'
import type { StreamBus } from '../../stream-bus'

// ============================================================================
// WRITER AGENT TYPES
// ============================================================================

export type WriterAgentConfig = {
  instruction: string
  skillset: string[]
  streamBus: StreamBus<AgentEvent>
  context: string
  abortSignal?: AbortSignal
}

export type ReviewResult = {
  approved: boolean
  feedback: string[]
}

export type WriterPhase = 'writing_start' | 'writing_delta' | 'writing_end' | 'reviewing_start' | 'reviewing_delta' | 'reviewing_end'

// ============================================================================
// SUB-AGENT TYPES
// ============================================================================

export type SubAgentConfig = {
  instruction: string
  skillset: string[]
  expectedOutput: {
    format: 'text' | 'json'
    description: string
  }
  complexity: 'simple' | 'complex'
  // streamBus: StreamBus<AgentEvent>
  abortSignal?: AbortSignal
}

export type SubAgentResult = {
  success: true
  response: string
  tokensUsed: number
} | {
  success: false
  error: string
  tokensUsed: number
}

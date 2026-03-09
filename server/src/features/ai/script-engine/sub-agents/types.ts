import { Project } from '@/db/schema'
import type { AgentEvent } from '../editor-agent/types'
import { ResumableStream } from '@/lib/resumable-stream'

// ============================================================================
// WRITER AGENT TYPES
// ============================================================================

export type WriterAgentConfig = {
  instruction: string
  skillset: string[]
  stream: ResumableStream<AgentEvent>
  project: Project
  operation: {
        type: "insert";
        insertAfterBlockId: string;
    } | {
        type: "delete";
        blockId: string;
    } | {
        type: "update";
        blockId: string;
    }
  abortSignal?: AbortSignal
}

export type ReviewResult = {
  approved: boolean
  feedback: string[]
}

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

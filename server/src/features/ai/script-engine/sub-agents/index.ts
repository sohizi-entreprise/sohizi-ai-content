// Sub-Agents for the Editor Agent System

// Writer Agent - Dedicated writing with review loop
export { WriterAgent } from './writer-agent'

// Flexible Sub-Agent - Custom tasks
export { SubAgent } from './sub-agent'

// Types
export type {
  WriterAgentConfig,
  WriterAgentResult,
  WriterPhase,
  SubAgentConfig,
  SubAgentResult,
} from './types'

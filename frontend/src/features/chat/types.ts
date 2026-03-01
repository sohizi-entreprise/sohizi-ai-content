// ============================================================================
// EDITOR TYPES
// ============================================================================

export type EditorType = 'synopsis' | 'script' | 'bible' | 'outline'

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export type ContextType = 'selection' | 'character' | 'location' | 'scene'


// ============================================================================
// MENTION TYPES
// ============================================================================

export type MentionItem = {
  id: string
  display: string
}

/**
 * Selection context with anchor information for AI editing
 */
export type SelectionContext = {
  id: string          // UUID that matches the context anchor in editor
  display: string     // Truncated text for display
  fullText: string    // Full selected text for AI context
  from: number        // Start position in document
  to: number          // End position in document
  blockId?: string    // Parent block ID for targeted edits
}

export type Mentions = {
  characters: MentionItem[]
  locations: MentionItem[]
  selections: SelectionContext[]
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export type Message = {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
  isStreaming?: boolean
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export type Mention = {
  id: string
  display: string
}

export type Conversation = {
  id: string
  projectId: string
  title: string
  editorType: EditorType
  createdAt: string
  updatedAt: string
}

export type ConversationWithMessages = Conversation & {
  messages: Message[]
}

// ============================================================================
// CHAT STATE TYPES
// ============================================================================

export type ChatUIState = {
  isInputFocused: boolean
  isMentionPopoverOpen: boolean
  mentionQuery: string
  isHistoryOpen: boolean
  isVoiceRecording: boolean
}

export type ChatState = {
  // Current conversation
  currentConversation: Conversation | null
  messages: Message[]
  
  // Context
  attachedContext: Mentions
  
  // Input
  inputContent: string
  
  // UI State
  ui: ChatUIState
  
  // Loading states
  isLoading: boolean
  isSending: boolean
  isStreaming: boolean
  
  // Errors
  error: string | null
}

// ============================================================================
// API TYPES
// ============================================================================

export type CreateConversationInput = {
  projectId: string
  editorType: EditorType
  title?: string
}

export type SendMessageInput = {
  conversationId: string
  content: string
  context?: Record<string, string>
}

export type ConversationListResponse = {
  conversations: Conversation[]
}

export type MessagesResponse = {
  messages: Message[]
}

// ============================================================================
// VOICE INPUT TYPES
// ============================================================================

export type VoiceInputState = {
  isSupported: boolean
  isRecording: boolean
  transcript: string
  error: string | null
}

// ============================================================================
// TOKEN/CONTEXT WINDOW TYPES
// ============================================================================

export type TokenUsage = {
  used: number
  total: number
  percentage: number
}

// ============================================================================
// AGENT EVENT TYPES
// ============================================================================

export type AgentEventType =
  | 'start'
  | 'reasoning_delta'
  | 'content_delta'
  | 'tool_call'
  | 'tool_result'
  | 'writer_start'
  | 'writer_progress'
  | 'writer_complete'
  | 'sub_agent_start'
  | 'sub_agent_progress'
  | 'sub_agent_complete'
  | 'error'
  | 'complete'
  | 'end'

export type AgentEvent = {
  type: AgentEventType
  runId: string
  data: unknown
}

export type AgentToolCall = {
  toolName: string
  toolId: string
  args: unknown
}

export type AgentToolResult = {
  toolName: string
  toolId: string
  result: unknown
  success: boolean
}

export type WriterProgress = {
  taskId: string
  phase: 'writing' | 'reviewing' | 'revising'
  content?: string
  revisionCount?: number
}

export type WriterComplete = {
  taskId: string
  success: boolean
  content: string
  reviewNotes: string
  revisionCount: number
}

export type SubAgentProgress = {
  taskId: string
  phase: string
  content?: string
}

export type SubAgentComplete = {
  taskId: string
  success: boolean
  output: unknown
}

// ============================================================================
// AGENT STATE TYPES
// ============================================================================

export type AgentState = {
  isRunning: boolean
  runId: string | null
  reasoning: string
  currentTool: AgentToolCall | null
  toolResults: AgentToolResult[]
  writerProgress: WriterProgress | null
  subAgentProgress: SubAgentProgress | null
  error: string | null
}

// ============================================================================
// SCRIPT BLOCK TYPES (for agent context)
// ============================================================================

export type ScriptBlock = {
  id: string
  type: string
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

export type ProjectInfo = {
  id: string
  format: 'storytime' | 'explainer' | 'screenplay' | 'short'
  genre: string
  tone: string
  audience: string
  maxDuration?: string
  constraints?: Record<string, unknown>
}

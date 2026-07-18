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

export type Mentions = {
  characters: MentionItem[]
  locations: MentionItem[]
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'tool'

export type MsgTextPart = {
  type: 'text'
  text: string
  isStreaming?: boolean
}

export type ReasoningPart = {
  type: 'reasoning'
  text: string
  isStreaming?: boolean
}

export type ImagePart = {
  type: 'image'
  image: URL
}

export type FilePart = {
  type: 'file'
  data: URL
  mediaType: string
}

export type MsgToolCallPart = {
  type: 'tool-call'
  toolName: string
  toolCallId: string
  input: unknown
  isStreaming?: boolean
}

export type ToolResult = {
  type: 'text'
  value: string
} | {
  type: 'error-text'
  value: string
}

export type MsgToolResultPart = {
  type: 'tool-result'
  toolName: string
  toolCallId: string
  output: ToolResult
  isStreaming?: boolean
}

export type MsgContext = {
  blocks?: string[]
  selections?: string[]
}

export type MsgMetadata = {
  reasoningText?: string;
  attachments?: Record<string, unknown>;
  context?: MsgContext;
}

export type MsgContent = MsgTextPart | MsgToolCallPart | MsgToolResultPart | ReasoningPart | ImagePart | FilePart

export type Message = {id: string; createdAt: string } & (
  | { role: 'user'; content: (ImagePart | FilePart | MsgTextPart)[] }
  | { role: 'assistant'; content: (ReasoningPart | MsgToolCallPart | MsgToolResultPart | MsgTextPart)[] }
  | { role: 'tool'; content: MsgToolResultPart[] }
)

export type AgentRunBlock = {
  id: string
  projectId: string
  conversationId: string
  status: 'pending' | 'running' | 'finished' | 'error'
  messages: Message[]
  metadata: Record<string, unknown>
  error: string | null
  createdAt: string
  updatedAt: string
}

export type SendMessageInput = {
  conversationId: string | null;
  prompt: string;
  context?: {
      blocks: string[];
      selections: string[];
  };
  selectedModel?: string;
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
  createdAt: string
  updatedAt: string
}

export type ConversationRun = {
  runId: string
  finishReason:  "error" | "not-finished" | "response" | "tool-calls" | "aborted" | "max-iterations"
  error: string | null
  messages: Message[]
}

// TO be deleted
export type ConversationWithMessages = Conversation & {
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


export type StreamTokenUsage = {
  input: number
  output: number
  reasoning: number
  cached: number
  total: number
  modelId: string
  cost: number
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

// ============================================================================
// TO BE KEPT
// ============================================================================

export type ChatCompletionRequest = {
  modelId: string;
  userPrompt: {
    role: 'user';
    content: (ImagePart | FilePart | MsgTextPart)[];
  };
  conversationId: string | null;
  editorContext?: Record<string, unknown>;
  isNew: boolean;
}

export type ChatCompletionResponse = {
  conversation: Conversation;
  run: AgentRunBlock;
}

export type DeleteOperation = {
  type: 'delete';
  fileId: string;
  fileName: string;
}

export type RefreshOperation = {
  type: 'refresh';
  fileId: string;
  fileName: string;
}

export type PatchOperation = {
  type: 'patch';
  content: string;
  fileId: string;
  fileName: string;
}

export type FilePendingOperation = DeleteOperation | PatchOperation | RefreshOperation

export type ChatStreamChunk = {
  name: string;
  runId: string;
} & (
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; text: string }
  | { type: 'usage'; usage: StreamTokenUsage }
  | { type: 'tool_call_delta'; toolCallId: string; input: string }
  | { type: 'tool_call_start'; toolCallId: string; toolName: string; input: string }
  | { type: 'tool_call_end'; toolCallId: string }
  | { type: 'tool_call'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool_result_complete'; toolCallId: string; toolName: string; success: boolean; output: string }
  | { type: 'complete'; text: string; finishReason: 'error' | 'not-finished' | 'response' | 'tool-calls' | 'aborted' | 'max-iterations'; usage: StreamTokenUsage; error?: string; reasoningText?: string }
  | { type: 'error'; error: string }
  | { type: 'abort' }
  | { type: 'identifier'; conversationId: string, conversationTitle: string }
  | { type: 'operation'; operation: FilePendingOperation }
)

export type LlmModel = {
  id: string;
  provider: string;
  name: string;
}





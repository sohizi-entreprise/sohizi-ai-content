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
  selections: MentionItem[]
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

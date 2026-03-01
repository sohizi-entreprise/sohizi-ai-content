// Components
export { ChatContainer, useChatContext } from './components/chat-container'
export { ChatHeader } from './components/chat-header'
export { ChatMessages } from './components/chat-messages'
export { ChatInput } from './components/chat-input'
export { ContextWindowDonut, calculateTokenUsage } from './components/context-window-donut'

// Hooks
export { useChat } from './hooks/use-chat'
export { useMentions } from './hooks/use-mentions'
export { useVoiceInput } from './hooks/use-voice-input'
export { useEditorBridge, useContextCreator, useSelectionSync } from './hooks/use-editor-bridge'
export { useAgentStream } from './hooks/use-agent-stream'
export type { AgentStreamInput, AgentStreamCallbacks, UseAgentStreamReturn } from './hooks/use-agent-stream'

// Store
export { useChatStore, subscribeToSelectionRemoval } from './store/chat-store'

// Types
export type {
  // Core types
  EditorType,
  ContextType,
  MentionItem,
  SelectionContext,
  MessageRole,
  Message,
  Conversation,
  ConversationWithMessages,
  ChatUIState,
  ChatState,
  CreateConversationInput,
  SendMessageInput,
  ConversationListResponse,
  MessagesResponse,
  VoiceInputState,
  TokenUsage,
  // Agent types
  AgentEventType,
  AgentEvent,
  AgentToolCall,
  AgentToolResult,
  WriterProgress,
  WriterComplete,
  SubAgentProgress,
  SubAgentComplete,
  AgentState,
  ScriptBlock,
  ScriptContent,
  ProjectInfo,
} from './types'

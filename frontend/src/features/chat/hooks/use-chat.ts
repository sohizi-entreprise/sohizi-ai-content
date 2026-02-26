import { useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { useChatStore } from '../store/chat-store'
import { useEditorBridge } from './use-editor-bridge'
import type { EditorType, Message, Conversation } from '../types'

type UseChatOptions = {
  projectId: string
  editorType: EditorType
  editorRef?: RefObject<Editor | null>
}

type UseChatReturn = {
  // State
  conversation: Conversation | null
  messages: Message[]
  isLoading: boolean
  isSending: boolean
  isStreaming: boolean
  error: string | null
  
  // Actions
  sendMessage: (message: Omit<Message, 'id' | 'conversationId' | 'createdAt'>) => Promise<void>
  createNewChat: () => void
  loadConversation: (conversationId: string) => Promise<void>
  
  // Editor bridge
  captureSelection: () => void
  hasSelection: boolean
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { projectId, editorType, editorRef } = options

  // Store
  const conversation = useChatStore((state) => state.currentConversation)
  const messages = useChatStore((state) => state.messages)
  const isLoading = useChatStore((state) => state.isLoading)
  const isSending = useChatStore((state) => state.isSending)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const error = useChatStore((state) => state.error)

  const setCurrentConversation = useChatStore((state) => state.setCurrentConversation)
  const createNewConversation = useChatStore((state) => state.createNewConversation)
  const addMessage = useChatStore((state) => state.addMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const appendToStreamingMessage = useChatStore((state) => state.appendToStreamingMessage)
  const clearContext = useChatStore((state) => state.clearContext)
  const setLoading = useChatStore((state) => state.setLoading)
  const setSending = useChatStore((state) => state.setSending)
  const setStreaming = useChatStore((state) => state.setStreaming)
  const setError = useChatStore((state) => state.setError)
  const setMessages = useChatStore((state) => state.setMessages)
  const addContext = useChatStore((state) => state.addContext)

  // Editor bridge for Cmd+I
  const editorBridge = useEditorBridge({
    editorRef,
    editorType,
    enabled: true,
  })

  // Initialize conversation on mount if none exists
  useEffect(() => {
    if (!conversation) {
      createNewConversation(projectId, editorType)
    }
  }, [conversation, projectId, editorType, createNewConversation])

  // Send message
  const sendMessage = useCallback(
    async (message: Omit<Message, 'id' | 'conversationId' | 'createdAt'>) => {
      if (!conversation) return

      setSending(true)
      setError(null)

      // Add user message immediately
      const userMessage: Message = {
        ...message,
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        createdAt: new Date().toISOString(),
      }
      addMessage(userMessage)
      clearContext()

      // Create placeholder for assistant response
      const assistantMessageId = crypto.randomUUID()
      const assistantMessage: Message = {
        id: assistantMessageId,
        conversationId: conversation.id,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      }
      addMessage(assistantMessage)
      setStreaming(true)

      try {
        // TODO: Replace with actual API call
        // For now, simulate a streaming response
        await simulateStreamingResponse(assistantMessageId, message.content, (chunk) => {
          appendToStreamingMessage(assistantMessageId, chunk)
        })

        // Mark message as complete
        updateMessage(assistantMessageId, { isStreaming: false })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
        // Remove the empty assistant message on error
        setMessages(messages.filter((m) => m.id !== assistantMessageId))
      } finally {
        setSending(false)
        setStreaming(false)
      }
    },
    [
      conversation,
      messages,
      addMessage,
      updateMessage,
      appendToStreamingMessage,
      clearContext,
      setMessages,
      setSending,
      setStreaming,
      setError,
    ]
  )

  // Create new chat
  const createNewChat = useCallback(() => {
    createNewConversation(projectId, editorType)
  }, [projectId, editorType, createNewConversation])

  // Load existing conversation
  const loadConversation = useCallback(
    async (conversationId: string) => {
      setLoading(true)
      setError(null)

      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/chat/conversations/${conversationId}/messages`)
        // const data = await response.json()
        
        // For now, just create a placeholder
        const loadedConversation: Conversation = {
          id: conversationId,
          projectId,
          title: 'Loaded Chat',
          editorType,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setCurrentConversation(loadedConversation)
        setMessages([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation')
      } finally {
        setLoading(false)
      }
    },
    [projectId, editorType, setCurrentConversation, setMessages, setLoading, setError]
  )

  // Capture selection manually
  const captureSelection = useCallback(() => {
    const context = editorBridge.captureSelection()
    if (context) {
      addContext(context)
    }
  }, [editorBridge, addContext])

  return {
    conversation,
    messages,
    isLoading,
    isSending,
    isStreaming,
    error,
    sendMessage,
    createNewChat,
    loadConversation,
    captureSelection,
    hasSelection: editorBridge.hasSelection,
  }
}

// Simulate streaming response (replace with actual API call)
async function simulateStreamingResponse(
  messageId: string,
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = `I understand you're asking about: "${userMessage.slice(0, 50)}..."

Here's a helpful response with **markdown** support:

1. First point
2. Second point
3. Third point

\`\`\`javascript
// Example code
const example = "Hello, world!";
console.log(example);
\`\`\`

Let me know if you need any clarification!`

  // Simulate streaming by sending chunks
  const words = response.split(' ')
  for (let i = 0; i < words.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30))
    onChunk(words[i] + (i < words.length - 1 ? ' ' : ''))
  }
}

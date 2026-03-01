import { RefObject, createContext, useContext } from 'react'
import type { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput, sendParams } from './chat-input'
import { useChat } from '../hooks/use-chat'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useChatStore } from '../store/chat-store'
import type { EditorType, Conversation } from '../types'

// ============================================================================
// CHAT CONTEXT
// ============================================================================

type ChatContextValue = {
  projectId: string
  editorType: EditorType
  editorRef?: RefObject<Editor | null>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatContainer')
  }
  return context
}

// ============================================================================
// CHAT CONTAINER
// ============================================================================

type ChatContainerProps = {
  projectId: string
  editorType: EditorType
  editorRef?: RefObject<Editor | null>
  className?: string
  onSubmit?: (params: sendParams) => Promise<void>
}

export function ChatContainer({
  projectId,
  editorType,
  editorRef,
  className,
  onSubmit,
}: ChatContainerProps) {
  const chat = useChat({ projectId, editorType, editorRef })
  const isHistoryOpen = useChatStore((state) => state.ui.isHistoryOpen)
  const setHistoryOpen = useChatStore((state) => state.setHistoryOpen)

  return (
    <ChatContext.Provider value={{ projectId, editorType, editorRef }}>
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <ChatHeader projectId={projectId} editorType={editorType} />

        {/* Messages */}
        <ChatMessages className="flex-1 min-h-0" />

        {/* Input */}
        <ChatInput onSend={onSubmit} disabled={chat.isSending} />

        {/* Error display */}
        {chat.error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
            {chat.error}
          </div>
        )}

        {/* History Sheet */}
        <ChatHistorySheet
          open={isHistoryOpen}
          onOpenChange={setHistoryOpen}
          projectId={projectId}
          editorType={editorType}
          onSelectConversation={chat.loadConversation}
        />
      </div>
    </ChatContext.Provider>
  )
}

// ============================================================================
// CHAT HISTORY SHEET
// ============================================================================

type ChatHistorySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  editorType: EditorType
  onSelectConversation: (id: string) => void
}

function ChatHistorySheet({
  open,
  onOpenChange,
  onSelectConversation,
}: ChatHistorySheetProps) {
  // TODO: Fetch conversation history from API
  const conversations: Conversation[] = []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px]">
        <SheetHeader>
          <SheetTitle>Chat History</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No previous chats
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id)
                  onOpenChange(false)
                }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
              >
                <div className="text-sm font-medium truncate">{conv.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(conv.updatedAt)}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return date.toLocaleDateString()
}

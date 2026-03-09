import { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { cn, timeFromNow } from '@/lib/utils'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { useSendMessage } from '../hooks/use-chat'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { EditorType, Conversation } from '../types'
import { useConversationStore } from '../store/conversation-store'


// ============================================================================
// CHAT CONTAINER
// ============================================================================

type ChatContainerProps = {
  projectId: string
  editorType: EditorType
  editorRef?: RefObject<Editor | null>
  className?: string
}

export function ChatContainer({
  projectId,
  className,
}: ChatContainerProps) {

  const sendMessage = useSendMessage(projectId)
  const isSendingMessage = useConversationStore(state => state.isSendingMessage)
  const currentConversation = useConversationStore(state => state.currentConversation)

  const conversationId = currentConversation?.id ?? null

  const disableSendBtn = isSendingMessage

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <ChatHeader projectId={projectId} />

      {/* Messages */}
      <ChatMessages className="flex-1 min-h-0"/>

      {/* Input */}
      <ChatInput onSend={(val) => {sendMessage({...val, conversationId})}} 
                  disabled={disableSendBtn} 
                  isLoading={isSendingMessage}
      />

      {/* Error display */}


      {/* History Sheet */}
      <ChatHistorySheet />
    </div>
  )
}

// ============================================================================
// CHAT HISTORY SHEET
// ============================================================================


function ChatHistorySheet() {

  const conversations: Conversation[] = []

  const toggleHistory = useConversationStore(state => state.toggleHistory)
  const isHistoryOpen = useConversationStore(state => state.isHistoryOpen)
  const setCurrentConversation = useConversationStore(state => state.setCurrentConversation)

  return (
    <Sheet open={isHistoryOpen} onOpenChange={toggleHistory}>
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
                  setCurrentConversation(conv)
                  toggleHistory(false)
                }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
              >
                <div className="text-sm font-medium truncate">{conv.title}</div>
                <div className="text-xs text-muted-foreground">
                  {timeFromNow(conv.createdAt)}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

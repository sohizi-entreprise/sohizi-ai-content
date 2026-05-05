import { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import type { EditorType } from '../types'


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


  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <ChatHeader projectId={projectId} />

      {/* Messages */}
      <ChatMessages projectId={projectId} className="flex-1 min-h-0"/>

      {/* Input */}
      <ChatInput projectId={projectId} />

    </div>
  )
}



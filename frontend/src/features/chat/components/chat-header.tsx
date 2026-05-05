import { IconPlus, IconBrandOpenai } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChatHistory } from './chat-history'
import { useChatStore } from '../store/chat-store'
import { useShallow } from 'zustand/react/shallow'

type ChatHeaderProps = {
  projectId: string
  className?: string
}

export function ChatHeader({ projectId, className }: ChatHeaderProps) {

  const conversation = useChatStore(useShallow((state) => state.activeConversation))
  const resetChatStore = useChatStore(useShallow((state) => state.reset))
  const title = conversation?.title ?? 'New Chat'

  const handleNewConversation = () => {
    resetChatStore()
  }

  return (
    <div className={cn('flex items-center justify-between px-4 border-b h-9', className)}>
      <div className="flex items-center gap-2 min-w-0">
        <IconBrandOpenai className="size-4 text-primary" />
        <h2 className="text-xs truncate min-w-0 flex-1">
          {title}
        </h2>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewConversation}
          className="size-8"
          aria-label="New chat"
        >
          <IconPlus className="size-4" />
        </Button>
        <ChatHistory projectId={projectId} />
      </div>
    </div>
  )
}

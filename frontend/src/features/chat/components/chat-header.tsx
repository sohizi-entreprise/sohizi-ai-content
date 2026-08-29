import { IconPlus } from '@tabler/icons-react'
import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'
import { useChatStore } from '../store/chat-store'
import { ChatHistory } from './chat-history'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SphereLoader } from '@/components/ui/loaders'

type ChatHeaderProps = {
  projectId: string
  className?: string
}

export function ChatHeader({ projectId, className }: ChatHeaderProps) {
  const conversation = useChatStore(
    useShallow((state) => state.activeConversation),
  )
  const initChatStore = useChatStore(useShallow((state) => state.init))

  const title = conversation?.title ?? 'New Chat'
  const isNew = conversation ? conversation.isNew : true

  const handleNewConversation = () => {
    initChatStore(projectId)
  }

  useEffect(() => {
    if (isNew) {
      initChatStore(projectId)
    }
  }, [projectId, isNew])

  return (
    <div
      className={cn(
        'flex items-center justify-between px-2 border-b h-9',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <SphereLoader
          isLoading={!!conversation?.isStreaming}
          size={28}
          showRings={false}
        />
        <h2 className="text-xs truncate min-w-0 flex-1">{title}</h2>
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

import { IconPlus, IconHistory } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useConversationStore } from '../store/conversation-store'
import { useCreateConversation } from '../hooks/use-chat'

type ChatHeaderProps = {
  projectId: string
  className?: string
}

export function ChatHeader({ projectId, className }: ChatHeaderProps) {
  const currentConversation = useConversationStore((state) => state.currentConversation)
  const toggleHistory = useConversationStore((state) => state.toggleHistory)

  const title = currentConversation?.title || 'Start a new chat'
  const {handleCreateConversation, isCreatingConversation} = useCreateConversation(projectId)

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-b', className)}>
      <h2 className="text-sm font-semibold truncate flex-1">{title}</h2>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateConversation}
          className="size-8"
          aria-label="New chat"
          disabled={isCreatingConversation}
        >
          <IconPlus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleHistory()}
          className="size-8"
          aria-label="Chat history"
        >
          <IconHistory className="size-4" />
        </Button>
      </div>
    </div>
  )
}

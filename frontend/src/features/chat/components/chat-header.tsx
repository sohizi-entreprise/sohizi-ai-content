import { IconPlus, IconHistory } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import type { EditorType } from '../types'

type ChatHeaderProps = {
  projectId: string
  editorType: EditorType
  className?: string
}

const editorTypeLabels: Record<EditorType, string> = {
  synopsis: 'Synopsis',
  script: 'Script',
  bible: 'Story Bible',
  outline: 'Outline',
}

export function ChatHeader({ projectId, editorType, className }: ChatHeaderProps) {
  const currentConversation = useChatStore((state) => state.currentConversation)
  const createNewConversation = useChatStore((state) => state.createNewConversation)
  const toggleHistory = useChatStore((state) => state.toggleHistory)

  const title = currentConversation?.title || `${editorTypeLabels[editorType]} Assistant`

  const handleNewChat = () => {
    createNewConversation(projectId, editorType)
  }

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-b', className)}>
      <h2 className="text-sm font-semibold truncate flex-1">{title}</h2>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewChat}
          className="size-8"
          aria-label="New chat"
        >
          <IconPlus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleHistory}
          className="size-8"
          aria-label="Chat history"
        >
          <IconHistory className="size-4" />
        </Button>
      </div>
    </div>
  )
}

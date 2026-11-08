import { IconPlus } from "@tabler/icons-react"
import { useShallow } from "zustand/react/shallow"
import { useEffect } from "react"
import { Button } from "@sohizi/ui/button"
import { useChatStore } from "../store/chat-store"
import { ChatHistory } from "./chat-history"
import { cn } from "@/lib/utils"

type ChatHeaderProps = {
  projectId: string
  className?: string
}

export function ChatHeader({ projectId, className }: ChatHeaderProps) {
  const conversation = useChatStore(
    useShallow((state) => state.activeConversation),
  )
  const initChatStore = useChatStore(useShallow((state) => state.init))

  const title = conversation?.title ?? "New Chat"
  const isNew = conversation ? conversation.isNew : true
  const isDifferentProject =
    Boolean(conversation) && conversation.projectId !== projectId

  const handleNewConversation = () => {
    initChatStore(projectId)
  }

  useEffect(() => {
    if (isNew || isDifferentProject) {
      initChatStore(projectId)
    }
  }, [projectId, isNew, isDifferentProject, initChatStore])

  return (
    <div
      className={cn(
        "flex items-center justify-between px-2 border-b h-9",
        className,
      )}
    >
      <h2 className="text-xs truncate min-w-0 flex-1 ml-2">{title}</h2>

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

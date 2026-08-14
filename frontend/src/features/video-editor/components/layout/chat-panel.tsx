import { ChatContainer } from '@/features/chat'

interface ChatPanelProps {
  projectId: string
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  return (
    <div className="h-full min-h-0 overflow-hidden rounded-xl bg-card ring-1 ring-border/60">
      <ChatContainer projectId={projectId} editorType="synopsis" />
    </div>
  )
}

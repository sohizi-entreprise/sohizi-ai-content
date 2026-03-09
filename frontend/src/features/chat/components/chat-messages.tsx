import { useEffect, useRef } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useConversationStore } from '../store/conversation-store'
import RenderMessage from './render-message'


export function ChatMessages({className}: {className?: string}) {
  const isStreaming = useConversationStore((state) => state.isStreaming)
  const currentRun = useConversationStore((state) => state.currentRun)
  const isEmpty = useConversationStore((state) => state.runs.length === 0 && state.currentRun === null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom during streaming so new content is visible
  useEffect(() => {
    if (!isStreaming || !scrollRef.current) return
    const viewport = scrollRef.current
    const scrollToBottom = () => {
      viewport.scrollTop = viewport.scrollHeight
    }
    scrollToBottom()
    const raf = requestAnimationFrame(scrollToBottom)
    return () => cancelAnimationFrame(raf)
  }, [isStreaming, currentRun?.messages])

  if (isEmpty) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <IconSparkles className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Start a conversation</p>
          <p className="text-xs mt-1">Ask me anything about your content</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className={cn('flex-1', className)} ref={scrollRef}>
      <div className="p-4 space-y-4">
        <RenderAllRuns />
        <RenderCurrentRun />
      </div>
    </ScrollArea>
  )
}

function RenderAllRuns(){
  const runs = useConversationStore((state) => state.runs)
  return (
    <div className='space-y-6'>
      {runs.map((run) => (
        <div key={run.runId} className='space-y-2'>
          {
            run.messages.map((message) => (
              <RenderMessage key={message.id} message={message} />
            ))
          }
        </div>
      ))}
    </div>
  )
}

function RenderCurrentRun(){

  const currentRun = useConversationStore((state) => state.currentRun)
  const isStreaming = useConversationStore((state) => state.isStreaming)

  if(!currentRun) return null

  const messages = currentRun.messages

  return (
    <div className='space-y-4'>
      {messages.map((message) => (
        <RenderMessage key={message.id} message={message} />
      ))}
      {
        isStreaming && <p>Planning next steps...</p>
      }
    </div>
  )

}


import { useState } from 'react'
import {
  MessageSquare,
  Plus,
  History,
  ChevronDown,
  Sparkles,
  ArrowUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEditorStore } from '../../stores/editor-store'
import type { ChatMessage } from '../../types'

function ReasoningBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="size-3 text-primary" />
        <span className="font-medium">Reasoning</span>
        <ChevronDown
          className={cn('ml-auto size-3 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'size-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold',
          isUser
            ? 'bg-primary/20 text-primary'
            : 'bg-accent/20 text-accent',
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>
      <div
        className={cn(
          'flex-1 rounded-lg px-3 py-2',
          isUser
            ? 'bg-primary/10 text-foreground'
            : 'bg-muted/40 text-foreground',
        )}
      >
        <p className="text-xs leading-relaxed">{message.content}</p>
        {message.reasoning && <ReasoningBlock content={message.reasoning} />}
        <span className="mt-1 block text-[10px] text-muted-foreground/60">
          {message.timestamp}
        </span>
      </div>
    </div>
  )
}

export function AIPanel() {
  const messages = useEditorStore((s) => s.aiMessages)
  const [input, setInput] = useState('')

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Assistance</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
            <History className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Chat body */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </div>
      </ScrollArea>

      {/* Input footer */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-primary"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
            <Plus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="size-3" />
            Builder
          </Button>
        </div>
      </div>
    </div>
  )
}

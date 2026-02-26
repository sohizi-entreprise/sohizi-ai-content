import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IconUser, IconSparkles, IconCopy, IconCheck } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import { ContextChipList } from './context-chip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import type { Message } from '../types'

type ChatMessagesProps = {
  className?: string
}

export function ChatMessages({ className }: ChatMessagesProps) {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  if (messages.length === 0) {
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
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="animate-pulse">●</div>
            <span>Thinking...</span>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

type MessageBubbleProps = {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 size-7 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary/20' : 'bg-accent/20'
        )}
      >
        {isUser ? (
          <IconUser className="size-4 text-primary" />
        ) : (
          <IconSparkles className="size-4 text-accent" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
        {/* Context chips for user messages */}
        {isUser && message.context && message.context.length > 0 && (
          <ContextChipList contexts={message.context} readonly className="mb-2" />
        )}

        {/* Message content */}
        <div
          className={cn(
            'rounded-lg px-3 py-2 max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground mt-1 px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

type MarkdownContentProps = {
  content: string
}

function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm prose-invert max-w-none"
      components={{
        // Custom code block with copy button
        code({ className, children, ...props }) {
          const isInline = !className
          
          if (isInline) {
            return (
              <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs" {...props}>
                {children}
              </code>
            )
          }

          return <CodeBlock className={className}>{children}</CodeBlock>
        },
        // Style other elements
        p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="text-sm list-disc pl-4 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="text-sm list-decimal pl-4 mb-2">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
        a: ({ children, href }) => (
          <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

type CodeBlockProps = {
  className?: string
  children: React.ReactNode
}

function CodeBlock({ className, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const codeString = String(children).replace(/\n$/, '')
  const language = className?.replace('language-', '') || 'text'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-black/50 px-3 py-1 rounded-t-md">
        <span className="text-[10px] text-muted-foreground uppercase">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <IconCheck className="size-3 text-green-500" />
          ) : (
            <IconCopy className="size-3" />
          )}
        </Button>
      </div>
      <pre className="bg-black/30 p-3 rounded-b-md overflow-x-auto">
        <code className="text-xs">{codeString}</code>
      </pre>
    </div>
  )
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

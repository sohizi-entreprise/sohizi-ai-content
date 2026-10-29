import { memo, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sohizi/ui/collapsible"
import { Spinner } from "@sohizi/ui/spinner"
import {
  formatElapsedDuration,
  getGranularToolDescriptor,
} from "../lib/tool-activity"
import { ChatToolCall, getToolIconComponent } from "./chat-tool-call"
import type {
  RunTimelineItem,
  ToolCallWithResult,
  ToolIconKind,
} from "../lib/tool-activity"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { MessageResponse } from "@/components/ai-elements/message"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { cn } from "@/lib/utils"

const AUTO_CLOSE_DELAY_MS = 800

type ChatThoughtBlockProps = {
  timelineItems: Array<RunTimelineItem>
  isRunning: boolean
  createdAt: string
  updatedAt?: string
  hasFinalResponse: boolean
}

function computeElapsedSeconds(createdAt: string, endTimeMs: number): number {
  const startMs = Date.parse(createdAt)
  if (Number.isNaN(startMs)) return 1
  return Math.max(1, Math.round((endTimeMs - startMs) / 1000))
}

function ChatThoughtBlockComponent({
  timelineItems,
  isRunning,
  createdAt,
  updatedAt,
  hasFinalResponse,
}: ChatThoughtBlockProps) {
  // Default open while running, or when a finished run has no final text response
  const [isOpen, setIsOpen] = useState<boolean>(
    () => isRunning || !hasFinalResponse,
  )
  const wasRunningRef = useRef<boolean>(isRunning)
  const completedAtMsRef = useRef<number | null>(
    !isRunning && updatedAt ? Date.parse(updatedAt) : null,
  )

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const endMs =
      !isRunning && updatedAt && !Number.isNaN(Date.parse(updatedAt))
        ? Date.parse(updatedAt)
        : Date.now()
    return computeElapsedSeconds(createdAt, endMs)
  })

  // Live 1s timer while running; freeze on completion
  useEffect(() => {
    if (isRunning) {
      completedAtMsRef.current = null
      const update = () => {
        setElapsedSeconds(computeElapsedSeconds(createdAt, Date.now()))
      }
      update()
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    }

    if (completedAtMsRef.current === null) {
      const parsedUpdated = updatedAt ? Date.parse(updatedAt) : Number.NaN
      completedAtMsRef.current =
        !Number.isNaN(parsedUpdated) && parsedUpdated >= Date.parse(createdAt)
          ? parsedUpdated
          : Date.now()
    }
    setElapsedSeconds(
      computeElapsedSeconds(createdAt, completedAtMsRef.current),
    )
  }, [isRunning, createdAt, updatedAt])

  // Auto-open when run starts streaming; auto-collapse when transitioning from running -> finished
  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true
      setIsOpen(true)
      return
    }

    if (wasRunningRef.current && hasFinalResponse) {
      wasRunningRef.current = false
      const timer = setTimeout(() => {
        setIsOpen(false)
      }, AUTO_CLOSE_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [isRunning, hasFinalResponse])

  if (timelineItems.length === 0 && !isRunning) {
    return null
  }

  const formattedDuration = formatElapsedDuration(elapsedSeconds)
  const headerLabel = isRunning
    ? `Working for ${formattedDuration}`
    : `Worked for ${formattedDuration}`

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="not-prose w-full"
    >
      <div
        className={cn(
          "flex w-full items-center",
          isOpen && "border-b border-border/60 pb-2",
        )}
      >
        <CollapsibleTrigger
          type="button"
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {isRunning ? (
            <Shimmer duration={1.5}>{headerLabel}</Shimmer>
          ) : (
            <span>{headerLabel}</span>
          )}
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="pt-3 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <div className="flex flex-col gap-2.5 text-sm">
          {timelineItems.map((item) => (
            <TimelineItemRow key={item.id} item={item} />
          ))}

          {isRunning && timelineItems.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-3.5 shrink-0" />
              <Shimmer>Planning next step...</Shimmer>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function TimelineItemRow({ item }: { item: RunTimelineItem }) {
  switch (item.kind) {
    case "status-note":
      return (
        <div className="text-sm leading-relaxed text-foreground/90">
          <MessageResponse isAnimating={item.isStreaming}>
            {item.text}
          </MessageResponse>
        </div>
      )

    case "reasoning":
      return (
        <Reasoning isStreaming={item.isStreaming} className="mb-0">
          <ReasoningTrigger />
          <ReasoningContent>{item.text}</ReasoningContent>
        </Reasoning>
      )

    case "compaction":
      return (
        <ChatToolCall toolCall={item.toolCall} result={item.toolCall.result} />
      )

    case "tool-item":
      return (
        <ChatToolCall toolCall={item.toolCall} result={item.toolCall.result} />
      )

    case "tool-group":
      return (
        <ToolCallGroupView
          summary={item.summary}
          primaryIcon={item.primaryIcon}
          toolCalls={item.toolCalls}
          activeToolCall={item.activeToolCall}
        />
      )
  }
}

function ToolCallGroupView({
  summary,
  primaryIcon,
  toolCalls,
  activeToolCall,
}: {
  summary: string
  primaryIcon: ToolIconKind
  toolCalls: Array<ToolCallWithResult>
  activeToolCall: ToolCallWithResult | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const Icon = getToolIconComponent(primaryIcon)
  const isGroupStreaming = Boolean(activeToolCall)
  const activeDescriptor = activeToolCall
    ? getGranularToolDescriptor(activeToolCall)
    : null

  return (
    <div className="flex flex-col gap-1.5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          type="button"
          className="group inline-flex max-w-full items-center gap-2 rounded-md py-0.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {isGroupStreaming && !isOpen ? (
            <Spinner className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Icon className="size-3.5 shrink-0 text-muted-foreground/80" />
          )}
          <span className="truncate">
            {isGroupStreaming && !isOpen && activeDescriptor ? (
              <Shimmer>{activeDescriptor.text}</Shimmer>
            ) : (
              summary
            )}
          </span>
          {isOpen ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/70 transition-transform" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-1.5 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="relative">
            <div
              className={cn(
                "flex flex-col gap-1.5 pl-4",
                toolCalls.length > 6 && "max-h-52 overflow-y-auto pr-1 pb-3",
              )}
            >
              {toolCalls.map((tc) => (
                <ChatToolCall
                  key={tc.toolCallId}
                  toolCall={tc}
                  result={tc.result}
                />
              ))}
            </div>
            {toolCalls.length > 6 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t from-background to-transparent" />
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export const ChatThoughtBlock = memo(ChatThoughtBlockComponent)

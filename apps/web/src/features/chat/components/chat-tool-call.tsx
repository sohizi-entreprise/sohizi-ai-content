import { memo, useState } from "react"
import {
  BookOpen,
  Brain,
  FilePen,
  Globe,
  ListCollapse,
  Scissors,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react"
import { Spinner } from "@sohizi/ui/spinner"
import {
  IconCircle,
  IconCircleCheckFilled,
  IconCircleRectangleFilled,
} from "@tabler/icons-react"
import {
  getGranularToolDescriptor,
  humanizeToolName,
} from "../lib/tool-activity"
import { ToolFileTag } from "./tool-file-tag"
import { useChatRun } from "./chat-run-context"
import type { GranularToolDescriptor, ToolIconKind } from "../lib/tool-activity"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import type { MsgToolCallPart, MsgToolResultPart } from "../types"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"

// Control-flow tools that carry no useful signal for the user.
const HIDDEN_TOOLS = new Set([
  "endExecutionLoop",
  "finish",
  "provideStatusUpdate",
])

function getManageTaskAction(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || !("manageTask" in input)) {
    return undefined
  }
  return (input as { manageTask?: { action?: string } }).manageTask?.action
}

export function isVisibleToolCall(
  toolCall: MsgToolCallPart,
  options: {
    firstAddToolCallId: string | null
    hasTasks: boolean
  },
): boolean {
  if (HIDDEN_TOOLS.has(toolCall.toolName)) return false
  if (toolCall.toolName !== "manageTasks") return true

  return (
    getManageTaskAction(toolCall.input) === "add" &&
    toolCall.toolCallId === options.firstAddToolCallId &&
    options.hasTasks
  )
}

const ICON_BY_KIND: Record<ToolIconKind, LucideIcon> = {
  read: BookOpen,
  search: Search,
  edit: FilePen,
  web: Globe,
  media: Sparkles,
  video: Scissors,
  memory: Brain,
  wrench: Wrench,
  compaction: ListCollapse,
}

export function getToolIconComponent(kind: ToolIconKind): LucideIcon {
  return ICON_BY_KIND[kind]
}

export function renderDescriptorLabel(
  descriptor: GranularToolDescriptor,
): ReactNode {
  const { verb, text, fromRef, toRef, fileName } = descriptor

  if (fromRef && toRef) {
    return (
      <span className="inline">
        {verb} <ToolFileTag fileRef={fromRef} /> {"→"}{" "}
        <ToolFileTag fileRef={toRef} />
      </span>
    )
  }

  if (fromRef && fileName) {
    if (verb === "Creating" || verb === "Created") {
      return (
        <span className="inline">
          {verb} <span className="font-medium">{fileName}</span> in{" "}
          <ToolFileTag fileRef={fromRef} />
        </span>
      )
    }
    if (verb === "Renaming" || verb === "Renamed") {
      return (
        <span className="inline">
          {verb} <ToolFileTag fileRef={fromRef} /> to{" "}
          <span className="font-medium">{fileName}</span>
        </span>
      )
    }
  }

  if (fromRef) {
    return (
      <span className="inline">
        {verb} <ToolFileTag fileRef={fromRef} />
      </span>
    )
  }

  return <span>{text}</span>
}

type ChatToolCallProps = {
  toolCall: MsgToolCallPart
  result?: MsgToolResultPart
}

function ChatToolCallComponent({ toolCall }: ChatToolCallProps) {
  if (HIDDEN_TOOLS.has(toolCall.toolName)) return null

  const toolName = toolCall.toolName
  switch (toolName) {
    case "assignTask":
      return <AssignTaskToolCall toolCall={toolCall} />
    case "manageTasks":
      return <ManageTasksToolCall toolCall={toolCall} />
    case "contextCompaction":
      return <ContextCompactionToolCall toolCall={toolCall} />
    default: {
      const descriptor = getGranularToolDescriptor(toolCall)
      const Icon = getToolIconComponent(descriptor.icon)
      return (
        <ToolViewer
          icon={Icon}
          text={descriptor.text}
          label={renderDescriptorLabel(descriptor)}
          isStreaming={Boolean(toolCall.isStreaming)}
          input={descriptor.inspectableInput}
        />
      )
    }
  }
}

function ContextCompactionToolCall({
  toolCall,
}: {
  toolCall: MsgToolCallPart
}) {
  const isStreaming = Boolean(toolCall.isStreaming)
  const text = isStreaming
    ? "Compacting context - This can take a few minutes"
    : "Context automatically compacted"

  return (
    <div className="flex items-center gap-2 py-0.5 text-sm text-muted-foreground">
      {isStreaming ? (
        <Spinner className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ListCollapse className="size-3.5 shrink-0 text-muted-foreground/80" />
      )}
      {isStreaming ? <Shimmer>{text}</Shimmer> : <span>{text}</span>}
    </div>
  )
}

function AssignTaskToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as {
    subAgent?: string
    instructions?: string
  }
  const subAgent = input.subAgent ?? "Sub-agent"
  const text = isStreaming
    ? `Assigning task to ${subAgent}`
    : `Assigned task to ${subAgent}`
  const currentSubToolName = toolCall.currentSubToolName

  return (
    <div className="p-2 rounded-md bg-background border space-y-1">
      <div className="flex items-center gap-2">
        {isStreaming ? <Spinner className="size-4 shrink-0" /> : null}
        {isStreaming ? (
          <Shimmer className="text-sm flex-1">{text}</Shimmer>
        ) : (
          <p className="text-sm flex-1">{text}</p>
        )}
      </div>
      {isStreaming && currentSubToolName ? (
        <p className="text-xs text-muted-foreground">
          Calling {humanizeToolName(currentSubToolName)}
        </p>
      ) : null}
    </div>
  )
}

function ManageTasksToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const { tasks, firstAddToolCallId } = useChatRun()

  if (
    !isVisibleToolCall(toolCall, {
      firstAddToolCallId,
      hasTasks: tasks.length > 0,
    })
  ) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 border w-full rounded-lg p-2">
      {tasks.map((task, index) => (
        <div key={`${task.id}-${index}`} className="flex items-start gap-2">
          {task.status === "done" ? (
            <IconCircleCheckFilled className="relative text-muted-foreground top-0.5 size-4 shrink-0" />
          ) : task.status === "pending" ? (
            <IconCircle className="relative text-muted-foreground top-0.5 size-4 shrink-0" />
          ) : task.status === "in_progress" && toolCall.isStreaming ? (
            <Spinner className="relative text-muted-foreground top-0.5 size-4 shrink-0" />
          ) : (
            <IconCircleRectangleFilled className="relative text-muted-foreground top-0.5 size-4 shrink-0" />
          )}
          <span
            className={cn(
              "text-sm text-muted-foreground",
              task.status === "deleted" && "line-through",
            )}
          >
            {task.task}
          </span>
        </div>
      ))}
    </div>
  )
}

function ToolViewer(props: {
  icon: LucideIcon
  text: string
  label?: ReactNode
  isStreaming: boolean
  defaultOpen?: boolean
  input?: Record<string, unknown> | string
}) {
  const {
    icon: Icon,
    text,
    label,
    isStreaming,
    defaultOpen = false,
    input,
  } = props
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleClick = () => {
    if (!input || isStreaming) return
    setIsOpen(!isOpen)
  }

  return (
    <div className="space-y-1.5">
      <div className="group flex w-full items-center gap-2 text-muted-foreground">
        {isStreaming ? (
          <Spinner className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Icon className="size-3.5 shrink-0 text-muted-foreground/80" />
        )}
        <div
          className={cn(
            "min-w-0 truncate text-sm transition-colors",
            Boolean(input) &&
              !isStreaming &&
              "cursor-pointer hover:text-foreground",
          )}
          onClick={handleClick}
        >
          {isStreaming ? (
            <Shimmer>{text}</Shimmer>
          ) : (
            (label ?? <span>{text}</span>)
          )}
        </div>
      </div>

      {isOpen && input && (
        <div className="max-h-50 overflow-y-auto rounded-md bg-surface p-2">
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
          </p>
        </div>
      )}
    </div>
  )
}

export const ChatToolCall = memo(ChatToolCallComponent)

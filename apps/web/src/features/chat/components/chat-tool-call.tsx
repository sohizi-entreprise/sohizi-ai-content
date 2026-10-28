import { memo, useState } from "react"
import { FilePen, Globe, Scissors, Search, Wrench } from "lucide-react"
import { Spinner } from "@sohizi/ui/spinner"
import {
  IconCircle,
  IconCircleCheckFilled,
  IconCircleRectangleFilled,
  IconTextScan2,
} from "@tabler/icons-react"
import {
  fileRefLabel,
  getEditFileRefs,
  getExploreFileRef,
} from "../lib/tool-call-file-ref"
import { ToolFileTag } from "./tool-file-tag"
import { useChatRun } from "./chat-run-context"
import type { FileRef, FileToolCommand } from "../lib/tool-call-file-ref"
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

function humanize(toolName: string): string {
  const spaced = toolName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
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
      return assignTaskToolCall({ toolCall })
    case "manageTasks":
      return <ManageTasksToolCall toolCall={toolCall} />
    case "timelineExplore":
      return timelineExploreToolCall({ toolCall })
    case "timelineEdit":
      return timelineEditToolCall({ toolCall })
    case "loadSkill":
      return loadSkillToolCall({ toolCall })
    case "searchFile":
      return SearchFileToolCall({ toolCall })
    case "exploreFile":
      return ExploreFileToolCall({ toolCall })
    case "editFile":
      return EditFileToolCall({ toolCall })
    case "tavily-search":
    case "web_search":
    case "openrouter.web_search":
    case "openrouter:web_search":
      return WebSearchToolCall({ toolCall })
    case "tavily-extract":
    case "web_fetch":
    case "openrouter.web_fetch":
    case "openrouter:web_fetch":
      return WebFetchToolCall({ toolCall })
    default:
      return (
        <ToolViewer
          icon={Wrench}
          text={
            toolCall.isStreaming
              ? `Calling ${humanize(toolName)}`
              : `Called ${humanize(toolName)}`
          }
          isStreaming={toolCall.isStreaming ?? false}
          input={toolCall.input as Record<string, unknown>}
        />
      )
  }
}

function assignTaskToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
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
          Calling {humanize(currentSubToolName)}
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

function timelineExploreToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { command?: { cmd?: string } }
  const cmdName = input.command?.cmd ?? ""
  let text = ""
  if (cmdName) {
    text = humanize(cmdName)
  } else {
    text = isStreaming ? "Exploring timeline" : "Explored timeline"
  }
  return (
    <ToolViewer
      icon={Scissors}
      text={text}
      isStreaming={isStreaming}
      input={input.command}
    />
  )
}

function timelineEditToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { command?: { cmd?: string } }
  const cmdName = input.command?.cmd ?? ""
  let text = ""
  if (cmdName) {
    text = humanize(cmdName)
  } else {
    text = isStreaming ? "Editing timeline" : "Edited timeline"
  }
  return (
    <ToolViewer
      icon={Scissors}
      text={text}
      isStreaming={isStreaming}
      input={input.command}
    />
  )
}

function loadSkillToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { name: string }
  const skillName = input.name ? `: ${input.name}` : ""
  const text = isStreaming
    ? `Reading skill ${skillName}`
    : `Read skill${skillName}`
  return <ToolViewer icon={Search} text={text} isStreaming={isStreaming} />
}

function WebSearchToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { query?: string; search_query?: string }
  const query = input.query ?? input.search_query
  const text = query
    ? isStreaming
      ? `Searching: ${query}`
      : `Searched: ${query}`
    : isStreaming
      ? "Searching the web"
      : "Searched the web"
  return (
    <ToolViewer
      icon={Globe}
      text={text}
      isStreaming={isStreaming}
      input={input}
    />
  )
}

function WebFetchToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { url?: string; urls?: string[] }
  const url = input.url ?? input.urls?.[0]
  const extra =
    input.urls && input.urls.length > 1 ? ` (+${input.urls.length - 1})` : ""
  const text = url
    ? isStreaming
      ? `Reading ${url}${extra}`
      : `Read ${url}${extra}`
    : isStreaming
      ? "Reading web page"
      : "Read web page"
  return (
    <ToolViewer
      icon={Globe}
      text={text}
      isStreaming={isStreaming}
      input={input}
    />
  )
}

function SearchFileToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { command?: FileToolCommand }
  const command = input.command
  const cmdName = command?.cmd ?? ""
  let text = ""

  switch (cmdName) {
    case "search":
      text = isStreaming ? "Searching by keyword" : "Searched by keyword"
      break
    case "find":
      text = isStreaming ? "Searching file by name" : "Searched file by name"
      break
    default:
      text = isStreaming ? "Searching files" : "Searched files"
  }
  return (
    <ToolViewer
      icon={Search}
      text={text}
      isStreaming={isStreaming}
      input={command}
    />
  )
}

function ExploreFileToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { command?: FileToolCommand }
  const command = input.command
  const cmdName = command?.cmd ?? ""
  const fileRef = getExploreFileRef(command)
  const refText = fileRef ? fileRefLabel(fileRef) : null

  let verb = ""
  switch (cmdName) {
    case "list":
      verb = isStreaming ? "Listing" : "Listed"
      break
    case "exists":
      verb = isStreaming ? "Checking" : "Checked"
      break
    case "read":
      verb = isStreaming ? "Reading" : "Read"
      break
    case "describe":
      verb = isStreaming ? "Describing" : "Described"
      break
    default:
      verb = isStreaming ? "Exploring files" : "Explored files"
  }

  const fallback =
    cmdName === "list"
      ? "files"
      : cmdName === "exists"
        ? "if file exists"
        : cmdName
          ? "file"
          : null

  const text = refText
    ? `${verb} ${refText}`
    : fallback
      ? `${verb} ${fallback}`
      : verb

  return (
    <ToolViewer
      icon={IconTextScan2}
      text={text}
      label={
        fileRef ? (
          <ToolLabel>
            {verb} <ToolFileTag fileRef={fileRef} />
          </ToolLabel>
        ) : undefined
      }
      isStreaming={isStreaming}
      input={command}
    />
  )
}

function EditFileToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as {
    command?: FileToolCommand & { content?: string; newText?: string }
  }
  const command = input.command
  const displayedInput: string =
    command?.content ?? command?.newText ?? JSON.stringify(command, null, 2)
  const cmdName = command?.cmd ?? ""
  const { from, to, name } = getEditFileRefs(command)
  const defaultOpen = false // cmdName === "write" || cmdName === "patch"
  const fromText = from ? fileRefLabel(from) : null
  const toText = to ? fileRefLabel(to) : null

  let verb = ""
  switch (cmdName) {
    case "write":
      verb = isStreaming ? "Writing" : "Written"
      break
    case "patch":
      verb = isStreaming ? "Patching" : "Patched"
      break
    case "delete":
      verb = isStreaming ? "Deleting" : "Deleted"
      break
    case "move":
      verb = isStreaming ? "Moving" : "Moved"
      break
    case "copy":
      verb = isStreaming ? "Copying" : "Copied"
      break
    case "create-file":
      verb = isStreaming ? "Creating" : "Created"
      break
    case "rename":
      verb = isStreaming ? "Renaming" : "Renamed"
      break
    default:
      verb = isStreaming ? "Editing files" : "Edited files"
  }

  const { text, label } = buildEditLabel({
    cmdName,
    verb,
    from,
    to,
    name,
    fromText,
    toText,
  })

  return (
    <ToolViewer
      icon={FilePen}
      text={text}
      label={label}
      isStreaming={isStreaming}
      defaultOpen={defaultOpen}
      input={displayedInput}
    />
  )
}

function buildEditLabel({
  cmdName,
  verb,
  from,
  to,
  name,
  fromText,
  toText,
}: {
  cmdName: string
  verb: string
  from: FileRef | null
  to: FileRef | null
  name: string | null
  fromText: string | null
  toText: string | null
}): { text: string; label?: ReactNode } {
  switch (cmdName) {
    case "move":
    case "copy": {
      const text = [verb, fromText, fromText && toText ? "→" : null, toText]
        .filter(Boolean)
        .join(" ")
      if (!from && !to) {
        return { text: `${verb} file` }
      }
      return {
        text,
        label: (
          <ToolLabel>
            {verb}
            {from ? (
              <>
                {" "}
                <ToolFileTag fileRef={from} />
              </>
            ) : null}
            {to ? (
              <>
                {" → "}
                <ToolFileTag fileRef={to} />
              </>
            ) : null}
          </ToolLabel>
        ),
      }
    }
    case "create-file": {
      if (name && from) {
        return {
          text: `${verb} ${name} in ${fromText}`,
          label: (
            <ToolLabel>
              {verb} {name} in <ToolFileTag fileRef={from} />
            </ToolLabel>
          ),
        }
      }
      if (name) {
        return { text: `${verb} ${name}` }
      }
      if (from) {
        return {
          text: `${verb} file in ${fromText}`,
          label: (
            <ToolLabel>
              {verb} file in <ToolFileTag fileRef={from} />
            </ToolLabel>
          ),
        }
      }
      return { text: `${verb} file` }
    }
    case "rename": {
      if (from && name) {
        return {
          text: `${verb} ${fromText} to ${name}`,
          label: (
            <ToolLabel>
              {verb} <ToolFileTag fileRef={from} /> to {name}
            </ToolLabel>
          ),
        }
      }
      if (from) {
        return {
          text: `${verb} ${fromText}`,
          label: (
            <ToolLabel>
              {verb} <ToolFileTag fileRef={from} />
            </ToolLabel>
          ),
        }
      }
      if (name) {
        return { text: `${verb} file to ${name}` }
      }
      return { text: `${verb} file` }
    }
    default: {
      if (from) {
        return {
          text: `${verb} ${fromText}`,
          label: (
            <ToolLabel>
              {verb} <ToolFileTag fileRef={from} />
            </ToolLabel>
          ),
        }
      }
      return { text: cmdName ? `${verb} file` : verb }
    }
  }
}

function ToolLabel({ children }: { children: ReactNode }) {
  return <p className="inline">{children}</p>
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
    <div className="space-y-2">
      <div className="group w-full flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <div
          className={cn(
            "text-sm transition-colors",
            input && "cursor-pointer hover:text-foreground",
          )}
          onClick={handleClick}
        >
          {isStreaming ? <Shimmer>{text}</Shimmer> : (label ?? <p>{text}</p>)}
        </div>
      </div>

      {isOpen && (
        <div className="max-h-50 overflow-y-auto rounded-md bg-surface p-2">
          <p className="text-xs text-muted-foreground">
            {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
          </p>
        </div>
      )}
    </div>
  )
}

export const ChatToolCall = memo(ChatToolCallComponent)

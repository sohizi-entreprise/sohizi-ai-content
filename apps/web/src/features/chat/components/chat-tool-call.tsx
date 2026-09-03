import { memo, useState } from "react"
import {
  FilePen,
  FolderTree,
  ListChecks,
  Scissors,
  Search,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { MsgToolCallPart, MsgToolResultPart } from "../types"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"

// Control-flow tools that carry no useful signal for the user.
const HIDDEN_TOOLS = new Set(["endExecutionLoop", "finish"])

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
      return manageTasksToolCall({ toolCall })
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
  return (
    <div className="p-2 rounded-md bg-muted border flex items-center gap-2">
      {isStreaming ? (
        <Shimmer className="text-sm flex-1">{text}</Shimmer>
      ) : (
        <p className="text-sm flex-1">{text}</p>
      )}
    </div>
  )
}

function manageTasksToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as {
    manageTask?:
      | { action?: string; tasks?: Array<string> }
      | { action?: string; taskId?: string; status?: string }
  }
  const action = input.manageTask?.action ?? ""
  let text = ""
  switch (action) {
    case "add":
      text = isStreaming ? "Adding task" : "Added task"
      break
    case "update":
      text = isStreaming ? "Updating task" : "Updated task"
      break
    case "delete":
      text = isStreaming ? "Deleting task" : "Deleted task"
      break
    case "list":
      text = isStreaming ? "Listing tasks" : "Listed tasks"
      break
    case "clear":
      text = isStreaming ? "Clearing tasks" : "Cleared tasks"
      break
    default:
      text = isStreaming ? "Managing TODO list" : "Managed TODO list"
  }
  return (
    <ToolViewer
      icon={ListChecks}
      text={text}
      isStreaming={isStreaming}
      input={input}
    />
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
  return (
    <ToolViewer
      icon={Search}
      text={text}
      isStreaming={isStreaming}
    />
  )
}

function SearchFileToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { command?: { cmd?: string } }
  const cmdName = input.command?.cmd ?? ""
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
      input={input.command}
    />
  )
}

function ExploreFileToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as { command?: { cmd?: string } }
  const cmdName = input.command?.cmd ?? ""
  let text = ""
  switch (cmdName) {
    case "list":
      text = isStreaming ? "Listing files" : "Listed files"
      break
    case "exists":
      text = isStreaming ? "Checking if file exists" : "Checked if file exists"
      break
    case "read":
      text = isStreaming ? "Reading file" : "Read file"
      break
    case "describe":
      text = isStreaming ? "Describing file" : "Described file"
      break
    default:
      text = isStreaming ? "Exploring files" : "Explored files"
  }
  return (
    <ToolViewer
      icon={FolderTree}
      text={text}
      isStreaming={isStreaming}
      input={input.command}
    />
  )
}

function EditFileToolCall({ toolCall }: { toolCall: MsgToolCallPart }) {
  const isStreaming = toolCall.isStreaming ?? false
  const input = toolCall.input as {
    command?: { cmd?: string; content?: string; newText?: string }
  }
  const displayedInput: string =
    input.command?.content ??
    input.command?.newText ??
    JSON.stringify(input.command, null, 2)
  const cmdName = input.command?.cmd ?? ""
  let text = ""
  const defaultOpen = cmdName === "write" || cmdName === "patch"
  switch (cmdName) {
    case "write":
      text = isStreaming ? "Writing to file" : "Written to file"
      break
    case "patch":
      text = isStreaming ? "Patching file" : "Patched file"
      break
    case "delete":
      text = isStreaming ? "Deleting file" : "Deleted file"
      break
    case "move":
      text = isStreaming ? "Moving file" : "Moved file"
      break
    case "copy":
      text = isStreaming ? "Copying file" : "Copied file"
      break
    case "create-file":
      text = isStreaming ? "Creating file" : "Created file"
      break
    case "rename":
      text = isStreaming ? "Renaming file" : "Renamed file"
      break
    default:
      text = isStreaming ? "Editing files" : "Edited files"
  }
  return (
    <ToolViewer
      icon={FilePen}
      text={text}
      isStreaming={isStreaming}
      defaultOpen={defaultOpen}
      input={displayedInput}
    />
  )
}

function ToolViewer(props: {
  icon: LucideIcon
  text: string
  isStreaming: boolean
  defaultOpen?: boolean
  input?: Record<string, unknown> | string
}) {
  const { icon: Icon, text, isStreaming, defaultOpen = false, input } = props
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleClick = () => {
    if (!input || isStreaming) return
    setIsOpen(!isOpen)
  }

  return (
    <div className="space-y-2">
      <div className="w-full flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <div
          className={cn(
            "text-sm transition-colors",
            input && "cursor-pointer hover:text-foreground",
          )}
          onClick={handleClick}
        >
          {isStreaming ? <Shimmer>{text}</Shimmer> : <p className="">{text}</p>}
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

import {
  classifyFileRef,
  fileRefLabel,
  getEditFileRefs,
  getExploreFileRef,
} from "./tool-call-file-ref"
import type { FileRef, FileToolCommand } from "./tool-call-file-ref"
import type { Message, MsgToolCallPart, MsgToolResultPart } from "../types"

type Activity = { active: string; complete: string }

const activities: Partial<Record<string, Activity>> = {
  "/files/list": {
    active: "Browsing project files",
    complete: "Browsed project files",
  },
  "/files/exists": { active: "Checking a file", complete: "Checked a file" },
  "/files/read": { active: "Reading a file", complete: "Read a file" },
  "/files/describe": {
    active: "Reviewing a file",
    complete: "Reviewed a file",
  },
  "/files/find": { active: "Finding a file", complete: "Found files" },
  "/files/search": {
    active: "Searching project files",
    complete: "Searched project files",
  },
  "/files/syntax": {
    active: "Checking file format",
    complete: "Checked file format",
  },
  "/files/create": { active: "Creating a file", complete: "Created a file" },
  "/files/write": { active: "Writing a file", complete: "Wrote a file" },
  "/files/patch": { active: "Editing a file", complete: "Edited a file" },
  "/files/delete": { active: "Deleting a file", complete: "Deleted a file" },
  "/files/move": { active: "Moving a file", complete: "Moved a file" },
  "/files/copy": { active: "Copying a file", complete: "Copied a file" },
  "/files/rename": { active: "Renaming a file", complete: "Renamed a file" },
  "/web/search": { active: "Searching the web", complete: "Searched the web" },
  "/web/extract": { active: "Reading web pages", complete: "Read web pages" },
  "/media/models": {
    active: "Choosing a media model",
    complete: "Checked media models",
  },
  "/media/models/schema": {
    active: "Checking media options",
    complete: "Checked media options",
  },
  "/media/analyze/image": {
    active: "Analyzing an image",
    complete: "Analyzed an image",
  },
  "/media/analyze/video": {
    active: "Analyzing a video",
    complete: "Analyzed a video",
  },
  "/media/analyze/youtube": {
    active: "Analyzing a video",
    complete: "Analyzed a video",
  },
  "/media/extract-frame/youtube": {
    active: "Capturing a video frame",
    complete: "Captured a video frame",
  },
  "/media/assets/save": { active: "Saving media", complete: "Saved media" },
  "/media/jobs/wait": { active: "Waiting for media", complete: "Media ready" },
  "/media/jobs/status": {
    active: "Checking media progress",
    complete: "Checked media progress",
  },
  "/video-editor/overview": {
    active: "Reviewing the video",
    complete: "Reviewed the video",
  },
  "/video-editor/clips/list": {
    active: "Reviewing clips",
    complete: "Reviewed clips",
  },
  "/video-editor/clips/view": {
    active: "Reviewing a clip",
    complete: "Reviewed a clip",
  },
  "/video-editor/frame": {
    active: "Reviewing a frame",
    complete: "Reviewed a frame",
  },
  "/video-editor/tracks/view": {
    active: "Reviewing tracks",
    complete: "Reviewed tracks",
  },
  "/video-editor/clips/schema": {
    active: "Checking clip options",
    complete: "Checked clip options",
  },
  "/video-editor/composition": {
    active: "Updating the video",
    complete: "Updated the video",
  },
  "/video-editor/tracks/add": {
    active: "Adding a track",
    complete: "Added a track",
  },
  "/video-editor/tracks/update": {
    active: "Updating a track",
    complete: "Updated a track",
  },
  "/video-editor/tracks/remove": {
    active: "Removing a track",
    complete: "Removed a track",
  },
  "/video-editor/clips/add": {
    active: "Adding a clip",
    complete: "Added a clip",
  },
  "/video-editor/clips/update": {
    active: "Editing a clip",
    complete: "Edited a clip",
  },
  "/video-editor/clips/remove": {
    active: "Removing a clip",
    complete: "Removed a clip",
  },
}

const toolFallbacks: Partial<Record<string, Activity>> = {
  fileSystemAPI: {
    active: "Working with project files",
    complete: "Updated project files",
  },
  webAPI: { active: "Researching", complete: "Finished researching" },
  mediaOperationsAPI: {
    active: "Working with media",
    complete: "Finished media work",
  },
  videoEditorAPI: {
    active: "Working on the video",
    complete: "Updated the video",
  },
  apiDocRead: {
    active: "Checking available actions",
    complete: "Checked available actions",
  },
  getArtifact: {
    active: "Reviewing earlier work",
    complete: "Reviewed earlier work",
  },
  recallMemory: {
    active: "Reviewing project context",
    complete: "Reviewed project context",
  },
  saveMemory: {
    active: "Saving project context",
    complete: "Saved project context",
  },
  submitHtmlComposition: {
    active: "Finishing the composition",
    complete: "Finished the composition",
  },
}

export function getToolActivity(toolCall: MsgToolCallPart): string | null {
  const fallback = toolFallbacks[toolCall.toolName]
  if (!fallback) return null

  const input = toolCall.input
  const endpoint =
    input &&
    typeof input === "object" &&
    "endpoint" in input &&
    typeof input.endpoint === "string"
      ? input.endpoint
      : ""
  let activity = activities[endpoint] ?? fallback

  if (endpoint === "/media/assets/generate") {
    const body =
      input && typeof input === "object" && "body" in input ? input.body : null
    const kind =
      body && typeof body === "object" && "kind" in body ? body.kind : null
    activity =
      kind === "image"
        ? { active: "Creating an image", complete: "Created an image" }
        : kind === "video"
          ? { active: "Creating a video", complete: "Created a video" }
          : kind === "audio" || kind === "speech"
            ? { active: "Creating audio", complete: "Created audio" }
            : { active: "Creating media", complete: "Created media" }
  }

  return toolCall.isStreaming ? activity.active : activity.complete
}

// ============================================================================
// GRANULAR TOOL DESCRIPTORS & ROLLUP GROUPING
// ============================================================================

export type ToolRollupCategory =
  | "load-tool"
  | "read-file"
  | "search-file"
  | "edit-file"
  | "search-web"
  | "read-web"
  | "media"
  | "video"
  | "memory"
  | "other"

export type ToolIconKind =
  | "read"
  | "search"
  | "edit"
  | "web"
  | "media"
  | "video"
  | "memory"
  | "wrench"
  | "compaction"

export type GranularToolDescriptor = {
  icon: ToolIconKind
  category: ToolRollupCategory
  verb: string
  text: string
  fromRef?: FileRef | null
  toRef?: FileRef | null
  fileName?: string | null
  detail?: string | null
  inspectableInput?: Record<string, unknown> | string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getString(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null
  const val = obj[key]
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null
}

export function humanizeToolName(toolName: string): string {
  const spaced = toolName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const API_DISPLAY_NAMES: Record<string, string> = {
  fileSystemAPI: "file system",
  webAPI: "web",
  mediaOperationsAPI: "media",
  videoEditorAPI: "video editor",
}

export function getGranularToolDescriptor(
  toolCall: MsgToolCallPart,
): GranularToolDescriptor {
  const isStreaming = Boolean(toolCall.isStreaming)
  const input = toolCall.input
  const toolName = toolCall.toolName

  if (toolName === "contextCompaction") {
    const text = isStreaming
      ? "Compacting context - This can take a few minutes"
      : "Context automatically compacted"
    return {
      icon: "compaction",
      category: "other",
      verb: text,
      text,
    }
  }

  if (toolName === "apiDocRead") {
    const api = getString(input, "api")
    const apiLabel = api ? (API_DISPLAY_NAMES[api] ?? api) : null
    const verb = isStreaming ? "Loading" : "Loaded"
    const text = apiLabel ? `${verb} ${apiLabel} tool` : `${verb} a tool`
    return {
      icon: "wrench",
      category: "load-tool",
      verb,
      text,
      detail: apiLabel,
    }
  }

  if (toolName === "fileSystemAPI") {
    const endpoint = getString(input, "endpoint") ?? ""
    const params = isRecord(input) ? input.params : undefined
    const body = isRecord(input) ? input.body : undefined

    switch (endpoint) {
      case "/files/read": {
        const ref = classifyFileRef(getString(params, "filePath"))
        const verb = isStreaming ? "Reading" : "Read"
        const label = ref ? fileRefLabel(ref) : "a file"
        return {
          icon: "read",
          category: "read-file",
          verb,
          text: `${verb} ${label}`,
          fromRef: ref,
        }
      }
      case "/files/list": {
        const ref = classifyFileRef(getString(params, "filePath"))
        const verb = isStreaming ? "Listing files in" : "Listed files in"
        const fallback = isStreaming
          ? "Browsing project files"
          : "Browsed project files"
        return {
          icon: "read",
          category: "read-file",
          verb: ref ? verb : fallback,
          text: ref ? `${verb} ${fileRefLabel(ref)}` : fallback,
          fromRef: ref,
        }
      }
      case "/files/describe": {
        const ref = classifyFileRef(getString(params, "filePath"))
        const verb = isStreaming ? "Reviewing" : "Reviewed"
        const label = ref ? fileRefLabel(ref) : "a file"
        return {
          icon: "read",
          category: "read-file",
          verb,
          text: `${verb} ${label}`,
          fromRef: ref,
        }
      }
      case "/files/exists": {
        const ref = classifyFileRef(getString(params, "filePath"))
        const verb = isStreaming ? "Checking" : "Checked"
        const label = ref ? fileRefLabel(ref) : "a file"
        return {
          icon: "read",
          category: "read-file",
          verb,
          text: `${verb} ${label}`,
          fromRef: ref,
        }
      }
      case "/files/syntax": {
        const fileType = getString(params, "fileType")
        const verb = isStreaming ? "Checking" : "Checked"
        const target = fileType ? `${fileType} syntax` : "file format"
        return {
          icon: "read",
          category: "read-file",
          verb,
          text: `${verb} ${target}`,
        }
      }
      case "/files/search": {
        const query = getString(params, "query")
        const verb = isStreaming ? "Searching for" : "Searched for"
        const fallback = isStreaming
          ? "Searching project files"
          : "Searched project files"
        return {
          icon: "search",
          category: "search-file",
          verb: query ? verb : fallback,
          text: query ? `${verb} ${query}` : fallback,
          detail: query,
        }
      }
      case "/files/find": {
        const name =
          getString(params, "name") ??
          getString(params, "type") ??
          getString(params, "format")
        const verb = isStreaming ? "Finding files" : "Found files"
        return {
          icon: "search",
          category: "search-file",
          verb,
          text: name ? `${verb} matching ${name}` : verb,
          detail: name,
        }
      }
      case "/files/create": {
        const name = getString(body, "name")
        const parentRef = classifyFileRef(
          getString(body, "parentDirectoryPath"),
        )
        const verb = isStreaming ? "Creating" : "Created"
        const parentLabel = parentRef ? fileRefLabel(parentRef) : null
        const text =
          name && parentLabel
            ? `${verb} ${name} in ${parentLabel}`
            : name
              ? `${verb} ${name}`
              : `${verb} a file`
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text,
          fromRef: parentRef,
          fileName: name,
        }
      }
      case "/files/write": {
        const ref = classifyFileRef(getString(body, "filePath"))
        const verb = isStreaming ? "Writing" : "Wrote"
        const label = ref ? fileRefLabel(ref) : "a file"
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text: `${verb} ${label}`,
          fromRef: ref,
          inspectableInput: getString(body, "content") ?? undefined,
        }
      }
      case "/files/patch": {
        const ref = classifyFileRef(getString(body, "filePath"))
        const verb = isStreaming ? "Editing" : "Edited"
        const label = ref ? fileRefLabel(ref) : "a file"
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text: `${verb} ${label}`,
          fromRef: ref,
          inspectableInput: getString(body, "newText") ?? undefined,
        }
      }
      case "/files/delete": {
        const ref = classifyFileRef(getString(params, "filePath"))
        const verb = isStreaming ? "Deleting" : "Deleted"
        const label = ref ? fileRefLabel(ref) : "a file"
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text: `${verb} ${label}`,
          fromRef: ref,
        }
      }
      case "/files/move": {
        const fromRef = classifyFileRef(getString(body, "filePath"))
        const toRef = classifyFileRef(getString(body, "newParentPath"))
        const verb = isStreaming ? "Moving" : "Moved"
        const fromLabel = fromRef ? fileRefLabel(fromRef) : "a file"
        const toLabel = toRef ? fileRefLabel(toRef) : null
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text: toLabel
            ? `${verb} ${fromLabel} → ${toLabel}`
            : `${verb} ${fromLabel}`,
          fromRef,
          toRef,
        }
      }
      case "/files/copy": {
        const fromRef = classifyFileRef(getString(body, "fromFilePath"))
        const toRef = classifyFileRef(getString(body, "toFilePath"))
        const verb = isStreaming ? "Copying" : "Copied"
        const fromLabel = fromRef ? fileRefLabel(fromRef) : "a file"
        const toLabel = toRef ? fileRefLabel(toRef) : null
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text: toLabel
            ? `${verb} ${fromLabel} → ${toLabel}`
            : `${verb} ${fromLabel}`,
          fromRef,
          toRef,
        }
      }
      case "/files/rename": {
        const fromRef = classifyFileRef(getString(body, "filePath"))
        const newName = getString(body, "newName")
        const verb = isStreaming ? "Renaming" : "Renamed"
        const fromLabel = fromRef ? fileRefLabel(fromRef) : "a file"
        return {
          icon: "edit",
          category: "edit-file",
          verb,
          text: newName
            ? `${verb} ${fromLabel} to ${newName}`
            : `${verb} ${fromLabel}`,
          fromRef,
          fileName: newName,
        }
      }
      default: {
        const activity =
          getToolActivity(toolCall) ??
          (isStreaming ? "Working with project files" : "Updated project files")
        return {
          icon: "read",
          category: "read-file",
          verb: activity,
          text: activity,
        }
      }
    }
  }

  if (toolName === "webAPI") {
    const endpoint = getString(input, "endpoint") ?? ""
    const params = isRecord(input) ? input.params : undefined
    const body = isRecord(input) ? input.body : undefined

    if (endpoint === "/web/search") {
      const query = getString(params, "query")
      const verb = isStreaming ? "Searching" : "Searched"
      const text = query
        ? `${verb}: ${query}`
        : isStreaming
          ? "Searching the web"
          : "Searched the web"
      return {
        icon: "web",
        category: "search-web",
        verb,
        text,
        detail: query,
      }
    }

    if (endpoint === "/web/extract") {
      const urls =
        isRecord(body) && Array.isArray(body.urls)
          ? body.urls.filter((u): u is string => typeof u === "string")
          : []
      const firstUrl = urls.at(0) ?? null
      const extra = urls.length > 1 ? ` (+${urls.length - 1})` : ""
      const verb = isStreaming ? "Reading" : "Read"
      const text = firstUrl
        ? `${verb} ${firstUrl}${extra}`
        : isStreaming
          ? "Reading web pages"
          : "Read web pages"
      return {
        icon: "web",
        category: "read-web",
        verb,
        text,
        detail: firstUrl,
      }
    }

    const activity =
      getToolActivity(toolCall) ??
      (isStreaming ? "Searching the web" : "Searched the web")
    return {
      icon: "web",
      category: "search-web",
      verb: activity,
      text: activity,
    }
  }

  if (toolName === "mediaOperationsAPI") {
    const activity =
      getToolActivity(toolCall) ??
      (isStreaming ? "Working with media" : "Finished media work")
    const body = isRecord(input) ? input.body : undefined
    const label = getString(body, "label") ?? getString(body, "fileName")
    const text = label ? `${activity}: ${label}` : activity
    return {
      icon: "media",
      category: "media",
      verb: activity,
      text,
      detail: label,
    }
  }

  if (toolName === "videoEditorAPI") {
    const activity =
      getToolActivity(toolCall) ??
      (isStreaming ? "Working on the video" : "Updated the video")
    const params = isRecord(input) ? input.params : undefined
    const body = isRecord(input) ? input.body : undefined
    const ref = classifyFileRef(
      getString(params, "filePath") ?? getString(body, "filePath"),
    )
    const text = ref ? `${activity} in ${fileRefLabel(ref)}` : activity
    return {
      icon: "video",
      category: "video",
      verb: activity,
      text,
      fromRef: ref,
    }
  }

  if (toolName === "recallMemory" || toolName === "saveMemory") {
    const activity =
      getToolActivity(toolCall) ??
      (isStreaming ? "Reviewing project context" : "Reviewed project context")
    return {
      icon: "memory",
      category: "memory",
      verb: activity,
      text: activity,
    }
  }

  if (toolName === "getArtifact" || toolName === "submitHtmlComposition") {
    const activity =
      getToolActivity(toolCall) ??
      (isStreaming
        ? `Calling ${humanizeToolName(toolName)}`
        : `Called ${humanizeToolName(toolName)}`)
    return {
      icon: "wrench",
      category: "other",
      verb: activity,
      text: activity,
    }
  }

  // Legacy tools support
  if (toolName === "exploreFile") {
    const command = isRecord(input)
      ? (input.command as FileToolCommand | undefined)
      : undefined
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

    return {
      icon: "read",
      category: "read-file",
      verb,
      text,
      fromRef: fileRef,
      inspectableInput: command,
    }
  }

  if (toolName === "searchFile") {
    const command = isRecord(input)
      ? (input.command as FileToolCommand | undefined)
      : undefined
    const cmdName = command?.cmd ?? ""
    const keyword = command?.keyword ?? command?.name
    let baseText = ""
    switch (cmdName) {
      case "search":
        baseText = isStreaming ? "Searching by keyword" : "Searched by keyword"
        break
      case "find":
        baseText = isStreaming
          ? "Searching file by name"
          : "Searched file by name"
        break
      default:
        baseText = isStreaming ? "Searching files" : "Searched files"
    }
    const text = keyword ? `${baseText}: ${keyword}` : baseText
    return {
      icon: "search",
      category: "search-file",
      verb: baseText,
      text,
      detail: keyword ?? null,
      inspectableInput: command,
    }
  }

  if (toolName === "editFile") {
    const command = isRecord(input)
      ? (input.command as
          | (FileToolCommand & { content?: string; newText?: string })
          | undefined)
      : undefined
    const cmdName = command?.cmd ?? ""
    const { from, to, name } = getEditFileRefs(command)
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

    const text =
      cmdName === "move" || cmdName === "copy"
        ? [verb, fromText, fromText && toText ? "→" : null, toText]
            .filter(Boolean)
            .join(" ") || `${verb} file`
        : cmdName === "create-file"
          ? name && fromText
            ? `${verb} ${name} in ${fromText}`
            : name
              ? `${verb} ${name}`
              : fromText
                ? `${verb} file in ${fromText}`
                : `${verb} file`
          : cmdName === "rename"
            ? fromText && name
              ? `${verb} ${fromText} to ${name}`
              : fromText
                ? `${verb} ${fromText}`
                : name
                  ? `${verb} file to ${name}`
                  : `${verb} file`
            : fromText
              ? `${verb} ${fromText}`
              : cmdName
                ? `${verb} file`
                : verb

    return {
      icon: "edit",
      category: "edit-file",
      verb,
      text,
      fromRef: from,
      toRef: to,
      fileName: name,
      inspectableInput: command?.content ?? command?.newText ?? command,
    }
  }

  if (
    toolName === "tavily-search" ||
    toolName === "web_search" ||
    toolName === "openrouter.web_search" ||
    toolName === "openrouter:web_search"
  ) {
    const query = getString(input, "query") ?? getString(input, "search_query")
    const verb = isStreaming ? "Searching" : "Searched"
    const text = query
      ? `${verb}: ${query}`
      : isStreaming
        ? "Searching the web"
        : "Searched the web"
    return {
      icon: "web",
      category: "search-web",
      verb,
      text,
      detail: query,
      inspectableInput: isRecord(input) ? input : undefined,
    }
  }

  if (
    toolName === "tavily-extract" ||
    toolName === "web_fetch" ||
    toolName === "openrouter.web_fetch" ||
    toolName === "openrouter:web_fetch"
  ) {
    const urls =
      isRecord(input) && Array.isArray(input.urls)
        ? input.urls.filter((u): u is string => typeof u === "string")
        : []
    const url = getString(input, "url") ?? urls.at(0) ?? null
    const extra = urls.length > 1 ? ` (+${urls.length - 1})` : ""
    const verb = isStreaming ? "Reading" : "Read"
    const text = url
      ? `${verb} ${url}${extra}`
      : isStreaming
        ? "Reading web page"
        : "Read web page"
    return {
      icon: "web",
      category: "read-web",
      verb,
      text,
      detail: url,
      inspectableInput: isRecord(input) ? input : undefined,
    }
  }

  if (toolName === "timelineExplore" || toolName === "timelineEdit") {
    const command = isRecord(input)
      ? (input.command as { cmd?: string } | undefined)
      : undefined
    const cmdName = command?.cmd ?? ""
    const defaultText =
      toolName === "timelineExplore"
        ? isStreaming
          ? "Exploring timeline"
          : "Explored timeline"
        : isStreaming
          ? "Editing timeline"
          : "Edited timeline"
    const text = cmdName ? humanizeToolName(cmdName) : defaultText
    return {
      icon: "video",
      category: "video",
      verb: text,
      text,
      inspectableInput: command,
    }
  }

  const text = isStreaming
    ? `Calling ${humanizeToolName(toolName)}`
    : `Called ${humanizeToolName(toolName)}`
  return {
    icon: "wrench",
    category: "other",
    verb: text,
    text,
    inspectableInput: isRecord(input) ? input : undefined,
  }
}

const CATEGORY_PHRASES: Record<
  ToolRollupCategory,
  { singular: string; plural: string }
> = {
  "load-tool": { singular: "loaded a tool", plural: "loaded tools" },
  "read-file": { singular: "read a file", plural: "read files" },
  "search-file": { singular: "searched files", plural: "searched files" },
  "edit-file": { singular: "edited a file", plural: "edited files" },
  "search-web": { singular: "searched the web", plural: "searched the web" },
  "read-web": { singular: "read a web page", plural: "read web pages" },
  media: { singular: "worked with media", plural: "worked with media" },
  video: { singular: "updated the video", plural: "updated the video" },
  memory: {
    singular: "reviewed project context",
    plural: "reviewed project context",
  },
  other: { singular: "ran an action", plural: "ran actions" },
}

export function summarizeToolGroup(toolCalls: Array<MsgToolCallPart>): {
  summary: string
  primaryIcon: ToolIconKind
} {
  if (toolCalls.length === 0) {
    return { summary: "Actions", primaryIcon: "wrench" }
  }
  if (toolCalls.length === 1) {
    const desc = getGranularToolDescriptor(toolCalls[0])
    return { summary: desc.text, primaryIcon: desc.icon }
  }

  const counts = new Map<ToolRollupCategory, number>()
  const order: Array<ToolRollupCategory> = []
  let firstIcon: ToolIconKind = "wrench"

  toolCalls.forEach((tc, index) => {
    const desc = getGranularToolDescriptor(tc)
    if (index === 0) {
      firstIcon = desc.icon
    }
    const prev = counts.get(desc.category) ?? 0
    if (prev === 0) {
      order.push(desc.category)
    }
    counts.set(desc.category, prev + 1)
  })

  const phrases = order.map((cat) => {
    const count = counts.get(cat) ?? 1
    const entry = CATEGORY_PHRASES[cat]
    return count > 1 ? entry.plural : entry.singular
  })

  const joined = phrases.join(", ")
  const summary = joined.charAt(0).toUpperCase() + joined.slice(1)
  const primaryIcon: ToolIconKind = order.length === 1 ? firstIcon : "wrench"

  return { summary, primaryIcon }
}

// ============================================================================
// RUN TIMELINE & FINAL RESPONSE PARTITIONING
// ============================================================================

export type ToolCallWithResult = MsgToolCallPart & {
  result?: MsgToolResultPart
}

export type RunTimelineItem =
  | {
      kind: "reasoning"
      id: string
      text: string
      isStreaming: boolean
    }
  | {
      kind: "status-note"
      id: string
      text: string
      isStreaming: boolean
    }
  | {
      kind: "tool-group"
      id: string
      summary: string
      primaryIcon: ToolIconKind
      toolCalls: Array<ToolCallWithResult>
      activeToolCall: ToolCallWithResult | null
    }
  | {
      kind: "tool-item"
      id: string
      toolCall: ToolCallWithResult
    }
  | {
      kind: "compaction"
      id: string
      toolCall: ToolCallWithResult
      isStreaming: boolean
    }

export type RunPresentation = {
  userMessages: Array<Message>
  timelineItems: Array<RunTimelineItem>
  finalResponse: {
    id: string
    text: string
    isStreaming: boolean
  } | null
}

const STANDALONE_TOOL_NAMES = new Set([
  "assignTask",
  "manageTasks",
  "contextCompaction",
])

const HIDDEN_CONTROL_TOOLS = new Set(["endExecutionLoop", "finish"])

function extractStatusMessage(input: unknown): string | null {
  if (isRecord(input) && typeof input.message === "string") {
    const trimmed = input.message.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function isManageTaskVisible(
  toolCall: MsgToolCallPart,
  options: { firstAddToolCallId: string | null; hasTasks: boolean },
): boolean {
  if (!isRecord(toolCall.input) || !isRecord(toolCall.input.manageTask)) {
    return false
  }
  return (
    toolCall.input.manageTask.action === "add" &&
    toolCall.toolCallId === options.firstAddToolCallId &&
    options.hasTasks
  )
}

export function buildRunPresentation(
  messages: Array<Message>,
  options: {
    firstAddToolCallId: string | null
    hasTasks: boolean
  },
): RunPresentation {
  const userMessages: Array<Message> = []
  const toolResultsByCallId = new Map<string, MsgToolResultPart>()

  // First pass: collect user messages and tool results from both assistant and tool messages
  for (const message of messages) {
    if (message.role === "user") {
      userMessages.push(message)
      continue
    }
    if (message.role === "tool") {
      for (const part of message.content) {
        toolResultsByCallId.set(part.toolCallId, part)
      }
      continue
    }
    for (const part of message.content) {
      if (part.type === "tool-result") {
        toolResultsByCallId.set(part.toolCallId, part)
      }
    }
  }

  const assistantMessages = messages.filter(
    (m): m is Extract<Message, { role: "assistant" }> => m.role === "assistant",
  )

  // Determine if the last assistant message has a final response text
  let finalResponseMsgIndex = -1
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const msg = assistantMessages[i]
    const hasLaterAssistantActivity = i < assistantMessages.length - 1
    const hasNonStatusToolCalls = msg.content.some(
      (part) =>
        part.type === "tool-call" &&
        part.toolName !== "provideStatusUpdate" &&
        part.toolName !== "contextCompaction" &&
        !HIDDEN_CONTROL_TOOLS.has(part.toolName),
    )
    const hasText = msg.content.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    )

    if (hasText && !hasLaterAssistantActivity && !hasNonStatusToolCalls) {
      finalResponseMsgIndex = i
      break
    }
    if (hasNonStatusToolCalls || hasText) {
      break
    }
  }

  const rawItems: Array<
    | Exclude<RunTimelineItem, { kind: "tool-group" }>
    | { kind: "groupable-tool"; id: string; toolCall: ToolCallWithResult }
  > = []

  let finalResponse: RunPresentation["finalResponse"] = null

  assistantMessages.forEach((msg, msgIndex) => {
    const isFinalResponseMessage = msgIndex === finalResponseMsgIndex

    let reasoningText = ""
    let reasoningStreaming = false
    let messageText = ""
    let messageTextStreaming = false

    for (const part of msg.content) {
      if (part.type === "reasoning") {
        reasoningText += part.text
        if (part.isStreaming) reasoningStreaming = true
      } else if (part.type === "text") {
        messageText += part.text
        if (part.isStreaming) messageTextStreaming = true
      }
    }

    if (reasoningText.trim().length > 0) {
      rawItems.push({
        kind: "reasoning",
        id: `${msg.id}-reasoning`,
        text: reasoningText,
        isStreaming: reasoningStreaming,
      })
    }

    if (messageText.trim().length > 0) {
      if (isFinalResponseMessage) {
        finalResponse = {
          id: `${msg.id}-response`,
          text: messageText,
          isStreaming: messageTextStreaming,
        }
      } else {
        rawItems.push({
          kind: "status-note",
          id: `${msg.id}-text-note`,
          text: messageText,
          isStreaming: messageTextStreaming,
        })
      }
    }

    for (const part of msg.content) {
      if (part.type !== "tool-call") continue
      if (HIDDEN_CONTROL_TOOLS.has(part.toolName)) continue

      const result = toolResultsByCallId.get(part.toolCallId)
      const toolCallWithResult: ToolCallWithResult = {
        ...part,
        ...(result ? { result } : {}),
      }

      if (part.toolName === "provideStatusUpdate") {
        const statusText = extractStatusMessage(part.input)
        if (statusText) {
          rawItems.push({
            kind: "status-note",
            id: part.toolCallId,
            text: statusText,
            isStreaming: Boolean(part.isStreaming),
          })
        }
        continue
      }

      if (part.toolName === "contextCompaction") {
        rawItems.push({
          kind: "compaction",
          id: part.toolCallId,
          toolCall: toolCallWithResult,
          isStreaming: Boolean(part.isStreaming),
        })
        continue
      }

      if (part.toolName === "manageTasks") {
        if (isManageTaskVisible(part, options)) {
          rawItems.push({
            kind: "tool-item",
            id: part.toolCallId,
            toolCall: toolCallWithResult,
          })
        }
        continue
      }

      if (STANDALONE_TOOL_NAMES.has(part.toolName)) {
        rawItems.push({
          kind: "tool-item",
          id: part.toolCallId,
          toolCall: toolCallWithResult,
        })
        continue
      }

      rawItems.push({
        kind: "groupable-tool",
        id: part.toolCallId,
        toolCall: toolCallWithResult,
      })
    }
  })

  // Second pass: group consecutive `groupable-tool` items into `tool-group` (when 2+) or `tool-item` (when 1)
  const timelineItems: Array<RunTimelineItem> = []
  let pendingGroup: Array<ToolCallWithResult> = []

  const flushPendingGroup = () => {
    if (pendingGroup.length === 0) return
    if (pendingGroup.length === 1) {
      const only = pendingGroup[0]
      timelineItems.push({
        kind: "tool-item",
        id: only.toolCallId,
        toolCall: only,
      })
    } else {
      const { summary, primaryIcon } = summarizeToolGroup(pendingGroup)
      const activeToolCall =
        [...pendingGroup].reverse().find((tc) => tc.isStreaming) ?? null
      timelineItems.push({
        kind: "tool-group",
        id: `group-${pendingGroup[0].toolCallId}`,
        summary,
        primaryIcon,
        toolCalls: pendingGroup,
        activeToolCall,
      })
    }
    pendingGroup = []
  }

  for (const item of rawItems) {
    if (item.kind === "groupable-tool") {
      pendingGroup.push(item.toolCall)
    } else {
      flushPendingGroup()
      timelineItems.push(item)
    }
  }
  flushPendingGroup()

  return {
    userMessages,
    timelineItems,
    finalResponse,
  }
}

export function formatElapsedDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(1, Math.floor(totalSeconds))
  if (safeSeconds < 60) {
    return `${safeSeconds}s`
  }
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  if (seconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${seconds}s`
}

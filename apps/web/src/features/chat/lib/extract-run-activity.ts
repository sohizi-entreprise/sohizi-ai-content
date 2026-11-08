import { classifyFileRef, filePathBasename } from "./tool-call-file-ref"
import type {
  AgentRunBlock,
  Message,
  MsgToolCallPart,
  MsgToolResultPart,
} from "../types"

export type FileActivityTag = "created" | "updated"

export type RunFileActivityItem = {
  id: string
  name: string
  path: string | null
  fileId: string | null
  tag: FileActivityTag
  isDirectory: boolean
  fileType: string | null
  format: string | null
}

export type RunMediaRequestAsset = {
  id: string
  name: string
  url: string
  type: "image" | "video" | "audio" | "html"
}

export type RunMediaRequestStatus =
  "queued" | "running" | "completed" | "failed"

export type RunMediaRequestItem = {
  id: string
  toolCallId: string
  jobId: string | null
  kind: "image" | "video" | "audio" | "speech"
  label: string
  modelId: string | null
  parameters: Record<string, unknown>
  status: RunMediaRequestStatus
  assets: Array<RunMediaRequestAsset>
  error: string | null
}

export type RunActivitySummary = {
  runId: string
  files: Array<RunFileActivityItem>
  mediaRequests: Array<RunMediaRequestItem>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getString(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null
  const val = obj[key]
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null
}

function getBoolean(obj: unknown, key: string): boolean | null {
  if (!isRecord(obj)) return null
  const val = obj[key]
  return typeof val === "boolean" ? val : null
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ""
  if (trimmed === "/") return "/root"
  return trimmed.replace(/\/+$/, "")
}

export function joinProjectPath(parentPath: string, name: string): string {
  const cleanParent = normalizePath(parentPath)
  const cleanName = name.trim().replace(/^\/+|\/+$/g, "")
  if (!cleanParent) return `/${cleanName}`
  if (!cleanName) return cleanParent
  return `${cleanParent}/${cleanName}`
}

function replacePathBasename(filePath: string, newName: string): string {
  const cleanPath = normalizePath(filePath)
  const cleanName = newName.trim().replace(/^\/+|\/+$/g, "")
  const lastSlash = cleanPath.lastIndexOf("/")
  if (lastSlash <= 0) {
    return `/${cleanName}`
  }
  return `${cleanPath.slice(0, lastSlash)}/${cleanName}`
}

function inferFileTypeFromName(name: string): {
  fileType: string | null
  format: string | null
} {
  const lower = name.toLowerCase()
  if (lower.endsWith(".storyboard.md")) {
    return { fileType: "storyboard", format: "markdown" }
  }
  if (lower.endsWith(".skill.md")) {
    return { fileType: "skill", format: "markdown" }
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return { fileType: "document", format: "markdown" }
  }
  if (lower.endsWith(".json")) {
    return { fileType: "document", format: "json" }
  }
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/.test(lower)) {
    return { fileType: "image", format: null }
  }
  if (/\.(mp4|webm|mov|m4v)$/.test(lower)) {
    return { fileType: "video", format: null }
  }
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lower)) {
    return { fileType: "audio", format: null }
  }
  return { fileType: null, format: null }
}

function parseJsonSafe(raw: string | undefined | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeMediaKind(
  value: unknown,
): "image" | "video" | "audio" | "speech" {
  if (
    value === "image" ||
    value === "video" ||
    value === "audio" ||
    value === "speech"
  ) {
    return value
  }
  return "image"
}

function normalizeMediaStatus(value: unknown): RunMediaRequestStatus {
  switch (value) {
    case "queued":
    case "pending":
      return "queued"
    case "running":
    case "processing":
      return "running"
    case "completed":
      return "completed"
    case "failed":
    case "aborted":
      return "failed"
    default:
      return "running"
  }
}

function parseJobAssets(rawAssets: unknown): Array<RunMediaRequestAsset> {
  if (!Array.isArray(rawAssets)) return []
  const result: Array<RunMediaRequestAsset> = []
  for (const item of rawAssets) {
    if (!isRecord(item)) continue
    const id =
      getString(item, "id") ??
      getString(item, "assetId") ??
      getString(item, "url")
    const url = getString(item, "url")
    if (!id || !url) continue
    const rawType = getString(item, "type")
    const type: RunMediaRequestAsset["type"] =
      rawType === "video" || rawType === "audio" || rawType === "html"
        ? rawType
        : "image"
    const name = getString(item, "name") ?? filePathBasename(url)
    result.push({ id, name, url, type })
  }
  return result
}

const VIDEO_EDITOR_MUTATION_ENDPOINTS = new Set([
  "/video-editor/composition",
  "/video-editor/tracks/add",
  "/video-editor/clips/ripple-shift",
  "/video-editor/batch",
])

export function extractRunActivity(
  runId: string,
  messages: Array<Message>,
): RunActivitySummary {
  const toolResultsByCallId = new Map<string, MsgToolResultPart>()
  const toolCalls: Array<MsgToolCallPart> = []

  for (const message of messages) {
    if (message.role === "tool") {
      for (const part of message.content) {
        toolResultsByCallId.set(part.toolCallId, part)
      }
      continue
    }
    if (message.role === "assistant") {
      for (const part of message.content) {
        if (part.type === "tool-result") {
          toolResultsByCallId.set(part.toolCallId, part)
        } else if (part.type === "tool-call") {
          toolCalls.push(part)
        }
      }
    }
  }

  const filesByKey = new Map<string, RunFileActivityItem>()

  const upsertFileItem = (incoming: {
    path?: string | null
    fileId?: string | null
    name?: string | null
    tag: FileActivityTag
    isDirectory?: boolean
    fileType?: string | null
    format?: string | null
  }) => {
    const cleanPath = incoming.path ? normalizePath(incoming.path) : null
    const fileId = incoming.fileId ?? null
    const key = cleanPath || fileId
    if (!key) return

    const derivedName =
      incoming.name?.trim() ||
      (cleanPath ? filePathBasename(cleanPath) : "file")
    const inferred = inferFileTypeFromName(derivedName)
    const existing =
      filesByKey.get(key) ??
      [...filesByKey.values()].find(
        (item) =>
          (cleanPath !== null && item.path === cleanPath) ||
          (fileId !== null && item.fileId === fileId),
      )

    if (existing) {
      const mergedTag: FileActivityTag =
        existing.tag === "created" ? "created" : incoming.tag
      const updated: RunFileActivityItem = {
        ...existing,
        id: cleanPath ?? existing.path ?? fileId ?? existing.id,
        name: derivedName || existing.name,
        path: cleanPath ?? existing.path,
        fileId: fileId ?? existing.fileId,
        tag: mergedTag,
        isDirectory: incoming.isDirectory ?? existing.isDirectory,
        fileType: incoming.fileType ?? existing.fileType ?? inferred.fileType,
        format: incoming.format ?? existing.format ?? inferred.format,
      }
      filesByKey.delete(existing.id)
      filesByKey.set(updated.id, updated)
      return
    }

    const item: RunFileActivityItem = {
      id: key,
      name: derivedName,
      path: cleanPath,
      fileId,
      tag: incoming.tag,
      isDirectory: Boolean(incoming.isDirectory),
      fileType: incoming.fileType ?? inferred.fileType,
      format: incoming.format ?? inferred.format,
    }
    filesByKey.set(key, item)
  }

  const relocateFileItem = (
    fromRefValue: string | null,
    nextPath: string | null,
    nextName: string | null,
  ) => {
    const fromRef = classifyFileRef(fromRefValue)
    if (!fromRef) return

    const cleanFromPath =
      fromRef.kind === "path" ? normalizePath(fromRef.path) : null
    const fromId = fromRef.kind === "id" ? fromRef.id : null

    const existing = [...filesByKey.values()].find(
      (item) =>
        (cleanFromPath && item.path === cleanFromPath) ||
        (fromId && item.fileId === fromId),
    )

    const resolvedName =
      nextName?.trim() ||
      existing?.name ||
      (nextPath ? filePathBasename(nextPath) : null) ||
      (cleanFromPath ? filePathBasename(cleanFromPath) : "file")

    const resolvedPath = nextPath
      ? normalizePath(nextPath)
      : cleanFromPath && nextName
        ? replacePathBasename(cleanFromPath, nextName)
        : (existing?.path ?? cleanFromPath)

    if (existing) {
      filesByKey.delete(existing.id)
      const nextKey = resolvedPath ?? existing.id
      filesByKey.set(nextKey, {
        ...existing,
        id: nextKey,
        name: resolvedName,
        path: resolvedPath,
      })
      return
    }

    upsertFileItem({
      path: resolvedPath,
      fileId: fromId,
      name: resolvedName,
      tag: "updated",
      isDirectory: false,
    })
  }

  const mediaRequests: Array<RunMediaRequestItem> = []
  const mediaByJobId = new Map<string, RunMediaRequestItem>()

  for (const tc of toolCalls) {
    const result = toolResultsByCallId.get(tc.toolCallId)
    const isErrorResult = result?.output.type === "error-text"
    const input = tc.input

    if (tc.toolName === "fileSystemAPI") {
      if (isErrorResult) continue
      const endpoint = getString(input, "endpoint")
      const params = isRecord(input) ? input.params : undefined
      const body = isRecord(input) ? input.body : undefined

      switch (endpoint) {
        case "/files/create": {
          const name = getString(body, "name")
          const parentDir = getString(body, "parentDirectoryPath")
          if (!name) break
          const isDirectory = Boolean(getBoolean(body, "dir"))
          const parentRef = classifyFileRef(parentDir)
          const fullPath =
            parentRef?.kind === "path"
              ? joinProjectPath(parentRef.path, name)
              : null
          upsertFileItem({
            path: fullPath,
            name,
            tag: "created",
            isDirectory,
            fileType: getString(body, "type"),
            format: getString(body, "format"),
          })
          break
        }
        case "/files/write":
        case "/files/patch": {
          const ref = classifyFileRef(getString(body, "filePath"))
          if (!ref) break
          upsertFileItem({
            path: ref.kind === "path" ? ref.path : null,
            fileId: ref.kind === "id" ? ref.id : null,
            tag: "updated",
            isDirectory: false,
          })
          break
        }
        case "/files/move": {
          const filePath = getString(body, "filePath")
          const newParentPath = getString(body, "newParentPath")
          const newName = getString(body, "newName")
          if (!filePath) break
          const fallbackName = newName ?? filePathBasename(filePath)
          const nextPath =
            newParentPath && newParentPath.startsWith("/")
              ? joinProjectPath(newParentPath, fallbackName)
              : null
          relocateFileItem(filePath, nextPath, fallbackName)
          break
        }
        case "/files/rename": {
          const filePath = getString(body, "filePath")
          const newName = getString(body, "newName")
          if (!filePath || !newName) break
          relocateFileItem(filePath, null, newName)
          break
        }
        case "/files/copy": {
          const toRef = classifyFileRef(getString(body, "toFilePath"))
          if (!toRef) break
          upsertFileItem({
            path: toRef.kind === "path" ? toRef.path : null,
            fileId: toRef.kind === "id" ? toRef.id : null,
            tag: "created",
            isDirectory: false,
          })
          break
        }
        case "/files/delete": {
          const ref = classifyFileRef(getString(params, "filePath"))
          if (!ref) break
          if (ref.kind === "path") {
            const clean = normalizePath(ref.path)
            filesByKey.delete(clean)
          } else {
            filesByKey.delete(ref.id)
          }
          break
        }
      }
      continue
    }

    if (tc.toolName === "videoEditorAPI") {
      if (isErrorResult) continue
      const endpoint = getString(input, "endpoint")
      if (!endpoint || !VIDEO_EDITOR_MUTATION_ENDPOINTS.has(endpoint)) continue
      const body = isRecord(input) ? input.body : undefined
      const ref = classifyFileRef(getString(body, "filePath"))
      if (!ref) continue
      upsertFileItem({
        path: ref.kind === "path" ? ref.path : null,
        fileId: ref.kind === "id" ? ref.id : null,
        tag: "updated",
        isDirectory: false,
        fileType: "video-editor",
      })
      continue
    }

    if (tc.toolName === "editFile") {
      if (isErrorResult) continue
      const command = isRecord(input) ? input.command : undefined
      if (!isRecord(command)) continue
      const cmd = getString(command, "cmd")
      if (cmd === "create-file") {
        const name = getString(command, "name")
        const parent = getString(command, "parentPathOrId")
        if (!name) continue
        const fullPath =
          parent && parent.startsWith("/")
            ? joinProjectPath(parent, name)
            : null
        upsertFileItem({
          path: fullPath,
          name,
          tag: "created",
          isDirectory: false,
        })
      } else if (cmd === "write" || cmd === "patch") {
        const ref = classifyFileRef(getString(command, "filePathOrId"))
        if (!ref) continue
        upsertFileItem({
          path: ref.kind === "path" ? ref.path : null,
          fileId: ref.kind === "id" ? ref.id : null,
          tag: "updated",
          isDirectory: false,
        })
      } else if (cmd === "copy") {
        const ref = classifyFileRef(getString(command, "toPathOrId"))
        if (!ref) continue
        upsertFileItem({
          path: ref.kind === "path" ? ref.path : null,
          fileId: ref.kind === "id" ? ref.id : null,
          tag: "created",
          isDirectory: false,
        })
      } else if (cmd === "rename") {
        const filePath = getString(command, "filePathOrId")
        const newName = getString(command, "newName")
        if (!filePath || !newName) continue
        relocateFileItem(filePath, null, newName)
      }
      continue
    }

    if (tc.toolName === "mediaOperationsAPI") {
      const endpoint = getString(input, "endpoint")
      const params = isRecord(input) ? input.params : undefined
      const body = isRecord(input) ? input.body : undefined

      if (endpoint === "/media/assets/save") {
        if (isErrorResult) continue
        const parsedResult = parseJsonSafe(result?.output.value)
        const resultPath = getString(parsedResult, "path")
        const resultFileId = getString(parsedResult, "fileId")
        const resultName = getString(parsedResult, "name")
        const resultType = getString(parsedResult, "type")
        const resultFormat = getString(parsedResult, "format")

        const directoryPath = getString(body, "directoryPath")
        const fileName = getString(body, "fileName")
        const fallbackPath =
          directoryPath && directoryPath.startsWith("/") && fileName
            ? joinProjectPath(directoryPath, fileName)
            : null

        const path = resultPath ?? fallbackPath
        const name = resultName ?? fileName
        if (!path && !resultFileId && !name) continue

        upsertFileItem({
          path,
          fileId: resultFileId,
          name,
          tag: "created",
          isDirectory: false,
          fileType: resultType,
          format: resultFormat,
        })
        continue
      }

      if (endpoint === "/media/assets/generate") {
        const kind = normalizeMediaKind(isRecord(body) ? body.kind : undefined)
        const label =
          getString(body, "label") ??
          getString(body, "modelId") ??
          `Generate ${kind}`
        const modelId = getString(body, "modelId")
        const parameters =
          isRecord(body) && isRecord(body.parameters) ? body.parameters : {}

        const parsedResult = !isErrorResult
          ? parseJsonSafe(result?.output.value)
          : null
        const jobId = getString(parsedResult, "jobId")
        const status: RunMediaRequestStatus = isErrorResult
          ? "failed"
          : result
            ? normalizeMediaStatus(
                getString(parsedResult, "status") ?? "queued",
              )
            : "running"
        const error = isErrorResult ? result.output.value || "Failed" : null

        const item: RunMediaRequestItem = {
          id: jobId ?? tc.toolCallId,
          toolCallId: tc.toolCallId,
          jobId,
          kind,
          label,
          modelId,
          parameters,
          status,
          assets: [],
          error,
        }
        mediaRequests.push(item)
        if (jobId) {
          mediaByJobId.set(jobId, item)
        }
        continue
      }

      if (
        endpoint === "/media/jobs/wait" ||
        endpoint === "/media/jobs/status"
      ) {
        const requestedJobId =
          getString(body, "jobId") ?? getString(params, "jobId")
        const parsedResult = parseJsonSafe(result?.output.value)
        const jobId = getString(parsedResult, "jobId") ?? requestedJobId
        if (!jobId) continue

        const existing = mediaByJobId.get(jobId)
        if (!existing) continue

        if (isRecord(parsedResult)) {
          const nextStatus = normalizeMediaStatus(parsedResult.status)
          existing.status = isErrorResult ? "failed" : nextStatus
          const assets = parseJobAssets(parsedResult.assets)
          if (assets.length > 0) {
            existing.assets = assets
          }
          const err = getString(parsedResult, "error")
          if (err) {
            existing.error = err
          }
        } else if (isErrorResult && result.output.value) {
          existing.status = "failed"
          existing.error = result.output.value
        }
      }
    }
  }

  // Also reconcile with <job_update> blocks inside user messages if present
  for (const message of messages) {
    if (message.role !== "user") continue
    for (const part of message.content) {
      if (part.type !== "text" || !part.text.includes("<job_update>")) continue
      applyJobUpdateNotes(part.text, mediaByJobId)
    }
  }

  return {
    runId,
    files: [...filesByKey.values()],
    mediaRequests,
  }
}

function applyJobUpdateNotes(
  text: string,
  mediaByJobId: Map<string, RunMediaRequestItem>,
) {
  const lines = text.split("\n")
  let currentJob: RunMediaRequestItem | undefined

  for (const line of lines) {
    const headerMatch = line.match(
      /^-\s+(.+?)\s+\[([^\]]+)\]\s+(queued|running|completed|failed)(?::\s*(.*))?$/,
    )
    if (headerMatch) {
      const jobId = headerMatch[2]
      const rawStatus = headerMatch[3]
      const inlineError = headerMatch[4]
      const job = mediaByJobId.get(jobId.trim())
      currentJob = job
      if (job) {
        job.status = normalizeMediaStatus(rawStatus)
        if (inlineError && inlineError.trim()) {
          job.error = inlineError.trim()
        }
      }
      continue
    }

    const assetsMatch = line.match(/^\s*assets:\s*(\[.*\])\s*$/)
    if (assetsMatch && currentJob) {
      const parsed = parseJsonSafe(assetsMatch[1])
      const assets = parseJobAssets(parsed)
      if (assets.length > 0) {
        currentJob.assets = assets
      }
    }
  }
}

export function extractLatestRunActivity(
  runs: Array<AgentRunBlock>,
): RunActivitySummary | null {
  if (runs.length === 0) return null
  const latestRun = runs[runs.length - 1]
  const summary = extractRunActivity(latestRun.id, latestRun.messages)
  if (summary.files.length === 0 && summary.mediaRequests.length === 0) {
    return null
  }
  return summary
}

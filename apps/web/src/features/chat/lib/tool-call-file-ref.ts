import { validate as validateUuid } from "uuid"

export type FileRef =
  { kind: "path"; path: string } | { kind: "id"; id: string }

export type FileToolCommand = {
  cmd?: string
  filePathOrId?: string
  filepath?: string
  fileIdOrPath?: string
  fromPathOrId?: string
  toPathOrId?: string
  parentPathOrId?: string
  newParentPathOrId?: string
  newName?: string
  name?: string
  keyword?: string
}

export function classifyFileRef(
  value: string | undefined | null,
): FileRef | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/")) {
    return { kind: "path", path: trimmed }
  }
  if (validateUuid(trimmed)) {
    return { kind: "id", id: trimmed }
  }
  return null
}

export function filePathBasename(path: string): string {
  const trimmed = path.replace(/\/+$/, "")
  const segments = trimmed.split("/").filter(Boolean)
  return segments[segments.length - 1] ?? path
}

export function fileRefLabel(ref: FileRef): string {
  return ref.kind === "path" ? filePathBasename(ref.path) : "file"
}

export function getExploreFileRef(
  command: FileToolCommand | undefined,
): FileRef | null {
  if (!command) return null
  switch (command.cmd) {
    case "exists":
      return classifyFileRef(command.filepath)
    case "list":
    case "read":
    case "describe":
      return classifyFileRef(command.filePathOrId)
    default:
      return (
        classifyFileRef(command.filePathOrId) ??
        classifyFileRef(command.filepath)
      )
  }
}

export function getEditFileRefs(command: FileToolCommand | undefined): {
  from: FileRef | null
  to: FileRef | null
  name: string | null
} {
  if (!command) {
    return { from: null, to: null, name: null }
  }

  switch (command.cmd) {
    case "move":
      return {
        from: classifyFileRef(command.fileIdOrPath),
        to: classifyFileRef(command.newParentPathOrId),
        name: command.newName?.trim() || null,
      }
    case "copy":
      return {
        from: classifyFileRef(command.fromPathOrId),
        to: classifyFileRef(command.toPathOrId),
        name: null,
      }
    case "create-file":
      return {
        from: classifyFileRef(command.parentPathOrId),
        to: null,
        name: command.name?.trim() || null,
      }
    case "rename":
      return {
        from: classifyFileRef(command.filePathOrId),
        to: null,
        name: command.newName?.trim() || null,
      }
    default:
      return {
        from: classifyFileRef(command.filePathOrId),
        to: null,
        name: null,
      }
  }
}

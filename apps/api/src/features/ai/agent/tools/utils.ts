import type { ToolResult } from "./tool-definition"
import { validate as validateUuid } from "uuid"
import { FileObject } from "@/features/file-system/objects/file"
import { PathObject } from "@/features/file-system/objects/path"
import { FilePendingOperation } from "@/type"

export function success(
  output: string,
  operation?: FilePendingOperation[],
): ToolResult {
  return { success: true, output, operation }
}

export function failure(output: string): ToolResult {
  return { success: false, output }
}

export type FileObjectResolved =
  | {
      success: false
      error: string
    }
  | {
      success: true
      file: FileObject
    }

export async function resolveFileByPathOrId(
  filePathOrId: string | undefined,
  projectId: string,
): Promise<FileObjectResolved> {
  if (!filePathOrId) {
    return { success: false, error: "Either filepath or fileId is required." }
  }
  const filePath = filePathOrId.startsWith("/") ? filePathOrId : undefined
  const fileId = validateUuid(filePathOrId) ? filePathOrId : undefined

  if (!filePath && !fileId) {
    return { success: false, error: "Invalid filepath or fileId provided." }
  }

  let fileObjectRef: FileObject | null = null
  const pathObject = new PathObject()
  if (filePath) {
    const { fileObject } = await pathObject.resolveByPath(filePath, projectId)
    fileObjectRef = fileObject
  } else if (fileId) {
    const fileObject = await pathObject.resolveById(fileId, projectId)
    fileObjectRef = fileObject
  }
  if (!fileObjectRef) {
    return { success: false, error: "File not found" }
  }
  return { success: true, file: fileObjectRef }
}

export function formatSkill(data: {
  name: string
  description: string
  instructions: string
}) {
  return `
Skill details:

---
name: ${data.name}
description: ${data.description}
---
${data.instructions}
`.trim()
}

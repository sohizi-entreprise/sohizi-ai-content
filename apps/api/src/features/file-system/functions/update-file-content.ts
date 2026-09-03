import type { UpdateFileContentRequest } from "../payload"
import { ingestFileContentChunks } from "../ingest-file-content-chunks"
import * as fileSystemRepo from "../repo"
import { FileSystemOperationError } from "./base"

export const updateFileContent = async (
  projectId: string,
  fileNodeId: string,
  request: UpdateFileContentRequest,
) => {
  const fileContent = await fileSystemRepo.updateFileContent(
    projectId,
    fileNodeId,
    request,
  )
  if (!fileContent) {
    throw new FileSystemOperationError("Failed to update file content")
  }

  if (request.content !== undefined) {
    await ingestFileContentChunks({
      projectId,
      fileNodeId,
      content: fileContent.content ?? "",
    })
  }

  return fileContent
}

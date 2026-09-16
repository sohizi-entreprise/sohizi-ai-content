import type { FileCreationRequest, UpdateFileContentRequest } from "../payload"
import { MAX_FILE_DEPTH } from "../constants"
import * as fileSystemRepo from "../repo"
import type { InitialFileContent } from "../repo"
import { normalizeFileName, ltreeDepth } from "../utils"
import { FileSystemConflictError, FileSystemInputError } from "./base"

const EMPTY_FILE_CONTENT: UpdateFileContentRequest = {
  content: "",
  jsonContent: {},
  proseContent: { type: "doc", content: [] },
}

export const createFileNode = async (
  data: FileCreationRequest,
  content: UpdateFileContentRequest = EMPTY_FILE_CONTENT,
  initialContent?: InitialFileContent,
) => {
  if (!data.parentId) {
    throw new FileSystemInputError("Parent directory is required")
  }
  const parentFileNode = await fileSystemRepo.getFileNodeById(
    data.projectId,
    data.parentId,
  )
  if (!parentFileNode || !parentFileNode.directory) {
    throw new FileSystemInputError("Invalid parent directory")
  }

  if (
    !data.directory &&
    parentFileNode.format &&
    data.format !== parentFileNode.format
  ) {
    throw new FileSystemInputError(
      `This folder only allows files with format "${parentFileNode.format}"`,
    )
  }

  const parentDepth = ltreeDepth(parentFileNode.path)
  if (parentDepth + 1 > MAX_FILE_DEPTH) {
    throw new FileSystemInputError(
      `Maximum file depth of ${MAX_FILE_DEPTH} exceeded`,
    )
  }

  const normalizedName = normalizeFileName(data.name)
  if (!normalizedName) {
    throw new FileSystemInputError("Invalid file name")
  }

  const payload = { ...data, name: normalizedName }

  if (data.directory) {
    const fileNode = await fileSystemRepo.createFileNode(payload)
    if (!fileNode) {
      throw new FileSystemConflictError(
        "File name already exists in that parent directory.",
      )
    }
    return fileNode
  }

  const fileNode = await fileSystemRepo.createFileWithContent(
    data.projectId,
    payload,
    content,
    initialContent,
  )
  if (!fileNode) {
    throw new FileSystemConflictError(
      "File name already exists in that parent directory.",
    )
  }
  return fileNode
}

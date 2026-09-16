import type { FileNode } from "@/db/schema"
import { MAX_FILE_DEPTH } from "../constants"
import * as fileSystemRepo from "../repo"
import { FileSystemInputError } from "./base"
import { wouldCreateFileNodeCycle } from "./would-create-file-node-cycle"
import { ltreeDepth } from "../utils"

export async function validateMoveTarget(
  projectId: string,
  fileNode: FileNode,
  parentId: string | null,
) {
  let destinationParent: FileNode | undefined
  if (parentId !== null) {
    destinationParent = await fileSystemRepo.getFileNodeById(
      projectId,
      parentId,
    )
    if (!destinationParent || !destinationParent.directory) {
      throw new FileSystemInputError("Invalid parent directory")
    }
  }

  const wouldCreateCycle = await wouldCreateFileNodeCycle(
    projectId,
    fileNode.id,
    parentId,
  )
  if (wouldCreateCycle) {
    throw new FileSystemInputError(
      `Cannot assign parent "${parentId}" because it would create a cycle.`,
    )
  }

  const subtreeHeight = fileNode.directory
    ? await fileSystemRepo.getFileNodeSubtreeHeight(projectId, fileNode.id)
    : 0
  const parentDepth = destinationParent
    ? ltreeDepth(destinationParent.path)
    : -1

  const nextDepth = parentDepth + 1 + (subtreeHeight ?? 0)
  if (nextDepth > MAX_FILE_DEPTH) {
    throw new FileSystemInputError(
      `Maximum file depth of ${MAX_FILE_DEPTH} exceeded`,
    )
  }
}

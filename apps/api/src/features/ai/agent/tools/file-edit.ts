import { z } from 'zod'
import { buildBaseTool } from './tool-definition'
import type { ToolResult } from './tool-definition'
import {
  writeCommandSchema,
  patchCommandSchema,
  deleteCommandSchema,
  moveCommandSchema,
  copyCommandSchema,
  createCommandSchema,
  renameCommandSchema,
} from './command-schema'
import { FileContentPayload } from '@/features/file-system/objects/file'
import * as fileSystemRepo from '@/features/file-system/repo'
import { normalizeFileName } from '@/features/file-system/utils'
import { failure, success } from './utils'
import { getErrorMessage } from '@/utils/get-error-message'
import { PatchOperation, RefreshOperation } from '@/type'
import { Session } from '../core/session'
import { FileFormat, fileFormat } from '@/features/file-system/constants'

const toolSchema = z.discriminatedUnion('cmd', [
  writeCommandSchema,
  patchCommandSchema,
  deleteCommandSchema,
  moveCommandSchema,
  copyCommandSchema,
  createCommandSchema,
  renameCommandSchema,
])

export const editFileTool = buildBaseTool({
  name: 'editFile',
  description:
    'Performs modifications on the file system such as creating, deleting, moving and renaming file/directory, writing to file, pactching content, copying file content.',
  inputSchema: z.object({
    command: toolSchema,
  }),
  execute: async (input, { session }) => {
    const command = input.command
    switch (command.cmd) {
      case 'write':
        return executeWriteCommand(command, session)
      case 'patch':
        return executePatchCommand(command, session)
      case 'delete':
        return executeDeleteCommand(command, session)
      case 'move':
        return executeMoveCommand(command, session)
      case 'copy':
        return executeCopyCommand(command, session)
      case 'create-file':
        return executeCreateCommand(command, session)
      case 'rename':
        return executeRenameCommand(command, session)
      default:
        return failure(
          `Invalid command received. Valid commands are: write, patch, delete, move, copy, create-file.`,
        )
    }
  },
})

const EDIT_SUPPORTED_FORMATS: Partial<FileFormat>[] = [fileFormat.MARKDOWN]

async function executeWriteCommand(
  input: z.infer<typeof writeCommandSchema>,
  session: Session,
) {
  const { filePathOrId, content, strategy } = input
  const fileObject = await session.resolveFileByPathOrId(filePathOrId)
  if (!fileObject) {
    return failure(`File ${filePathOrId} not found`)
  }

  if (fileObject.isDirectory) {
    return failure(`Cannot write to directory.`)
  }
  if (fileObject.format === null) {
    return failure(`The file format is corrupted. You cannot write to it.`)
  }

  if (!EDIT_SUPPORTED_FORMATS.includes(fileObject.format)) {
    return failure(
      `The file format ${fileObject.format} is not supported for editing.`,
    )
  }

  let finalContent = ''
  let newContentPayload: FileContentPayload | undefined

  const fileContent = await fileObject.getFileContent()
  if (!fileContent.ok || fileContent.data === null) {
    return failure(
      fileContent.error || 'Failed to get the content of the file.',
    )
  }

  if (fileContent.data.type === 'markdown') {
    const currentContent = fileContent.data.data
    finalContent = buildContent(strategy, currentContent, content)
    newContentPayload = {
      type: 'markdown',
      data: finalContent,
    }
  } else {
    return failure(
      `The file content type ${fileContent.data.type} is not supported for editing.`,
    )
  }

  const operation: PatchOperation = {
    type: 'patch',
    content: finalContent,
    fileId: fileObject.id,
    fileName: fileObject.name,
  }

  await fileSystemRepo.upsertPendingFileOperation(
    session.projectId,
    fileObject.id,
    operation,
  )

  // We update the file cache to make sure that the next read operation will use the latest content.
  fileObject.updateFileContentCache(newContentPayload)

  const message = `Content written and send to the user for approval. The user will see the content and can approve or reject the change. Do not repeat the content in your response, they will see it directly on the editor.`

  return success(message, [operation])
}

async function executePatchCommand(
  input: z.infer<typeof patchCommandSchema>,
  session: Session,
) {
  const { filePathOrId, oldText, newText, replaceAll } = input
  const fileObject = await session.resolveFileByPathOrId(filePathOrId)
  if (!fileObject) {
    return failure(`File ${filePathOrId} not found`)
  }

  if (fileObject.isDirectory) {
    return failure(`Cannot patch directory.`)
  }
  if (fileObject.format === null) {
    return failure(`The file format is corrupted. You cannot patch it.`)
  }

  const fileContent = await fileObject.getFileContent()
  if (!fileContent.ok || fileContent.data === null) {
    return failure(
      fileContent.error || 'Failed to get the content of the file.',
    )
  }

  if (fileContent.data.type !== 'markdown') {
    return failure(
      `The file content type ${fileContent.data.type} is not supported for editing.`,
    )
  }

  let finalContent = fileContent.data.data
  if (replaceAll) {
    finalContent = finalContent.replaceAll(oldText, newText)
  } else {
    finalContent = finalContent.replace(oldText, newText)
  }

  const operation: PatchOperation = {
    type: 'patch',
    content: finalContent,
    fileName: fileObject.name,
    fileId: fileObject.id,
  }

  await fileSystemRepo.upsertPendingFileOperation(
    session.projectId,
    fileObject.id,
    operation,
  )

  // We update the file cache to make sure that the next read operation will use the latest content.
  fileObject.updateFileContentCache({
    type: 'markdown',
    data: finalContent,
  })

  const msg = `Content patched and send to the user for approval. The user will see the content and can approve or reject the change. Do not repeat the content in your response, they will see it directly on the editor.`

  return success(msg, [operation])
}

async function executeDeleteCommand(
  input: z.infer<typeof deleteCommandSchema>,
  session: Session,
): Promise<ToolResult> {
  const { filePathOrId } = input
  const fileObject = await session.resolveFileByPathOrId(filePathOrId)
  if (!fileObject) {
    return failure(`File ${filePathOrId} not found`)
  }

  if (fileObject.isDirectory) {
    return failure(`Cannot delete directory.`)
  }
  if (fileObject.format === null) {
    return failure(`The file format is corrupted. You cannot delete it.`)
  }

  const response = await fileObject.delete()
  if (!response.ok) {
    return failure(response.error ?? `Failed to delete file ${filePathOrId}`)
  }
  const parent = await fileObject.getParent()
  if (!parent) {
    return failure(
      `Failed to delete file ${filePathOrId} because the parent directory is not found.`,
    )
  }
  const operation: RefreshOperation = {
    type: 'refresh',
    fileId: parent.id,
    fileName: parent.name,
  }

  // We update the file cache to make sure that the next read operation will use the latest content.
  session.removeFileFromCache(filePathOrId)

  return success(`Deleted file ${filePathOrId} successfully.`, [operation])
}

async function executeMoveCommand(
  input: z.infer<typeof moveCommandSchema>,
  session: Session,
): Promise<ToolResult> {
  const { fileIdOrPath, newParentPathOrId, position, newName } = input
  const fileRef = await session.resolveFileByPathOrId(fileIdOrPath)
  if (!fileRef) {
    return failure(`File ${fileIdOrPath} not found`)
  }

  if (fileRef.isRoot) {
    return failure(`Cannot move root directory.`)
  }

  const newParentRef = await session.resolveFileByPathOrId(newParentPathOrId)
  if (!newParentRef) {
    return failure(`New parent ${newParentPathOrId} not found`)
  }

  let anchorId: string | null = null
  if (position.anchorFilePathOrId) {
    const anchorResult = await session.resolveFileByPathOrId(
      position.anchorFilePathOrId,
    )
    if (!anchorResult) {
      return failure(`Anchor file ${position.anchorFilePathOrId} not found`)
    }
    anchorId = anchorResult.id
  }

  const currentParent = await fileRef.getParent()
  if (!currentParent) {
    return failure(
      `Failed to move ${fileIdOrPath} because the current parent is not found.`,
    )
  }
  const response = await fileRef.moveTo(
    newParentRef,
    position.insertMode,
    anchorId,
    newName,
  )
  if (!response.ok) {
    return failure(
      response.error ??
        `Failed to move ${fileIdOrPath} to ${newParentPathOrId}`,
    )
  }

  const operation: RefreshOperation[] = [
    {
      type: 'refresh',
      fileId: currentParent.id,
      fileName: currentParent.name,
    },
    {
      type: 'refresh',
      fileId: newParentRef.id,
      fileName: newParentRef.name,
    },
  ]

  return success(
    `Moved ${fileIdOrPath} to ${newParentPathOrId} successfully.`,
    operation,
  )
}

async function executeCopyCommand(
  input: z.infer<typeof copyCommandSchema>,
  session: Session,
): Promise<ToolResult> {
  const { fromPathOrId, toPathOrId } = input

  const sourceFileRef = await session.resolveFileByPathOrId(fromPathOrId)
  if (!sourceFileRef) {
    return failure(`Source file ${fromPathOrId} not found`)
  }

  const targetFileRef = await session.resolveFileByPathOrId(toPathOrId)
  if (!targetFileRef) {
    return failure(`Target file ${toPathOrId} not found`)
  }

  const response = await sourceFileRef.copyTo(targetFileRef)
  if (!response.ok) {
    return failure(
      response.error ?? `Failed to copy ${fromPathOrId} to ${toPathOrId}`,
    )
  }

  const operation: RefreshOperation[] = [
    {
      type: 'refresh',
      fileId: sourceFileRef.id,
      fileName: sourceFileRef.name,
    },
    {
      type: 'refresh',
      fileId: targetFileRef.id,
      fileName: targetFileRef.name,
    },
  ]

  return success(
    `Copied content from ${fromPathOrId} to ${toPathOrId} successfully.`,
    operation,
  )
}

async function executeCreateCommand(
  input: z.infer<typeof createCommandSchema>,
  session: Session,
): Promise<ToolResult> {
  const { parentPathOrId, dir, name, position } = input

  try {
    const parentFolder = await session.resolveFileByPathOrId(parentPathOrId)
    if (!parentFolder) {
      return failure(`Parent folder ${parentPathOrId} not found`)
    }
    if (!parentFolder.isDirectory) {
      return failure(`Parent path "${parentPathOrId}" is not a directory.`)
    }
    const parentId = parentFolder.id

    const normalizedName = normalizeAndValidateName(name)
    let anchorId: string | null = null

    if (position.anchorFilePathOrId) {
      const anchorResult = await session.resolveFileByPathOrId(
        position.anchorFilePathOrId,
      )
      if (!anchorResult) {
        return failure(`Anchor file ${position.anchorFilePathOrId} not found`)
      }
      anchorId = anchorResult.id
    }

    const newFileNode = await fileSystemRepo.createFileWithContentAtPosition(
      session.projectId,
      {
        projectId: session.projectId,
        name: normalizedName,
        directory: dir,
        parentId,
        position: 0,
        editable: true,
        format: 'markdown',
      },
      anchorId,
      position.insertMode,
    )

    if (!newFileNode) {
      return failure(
        `Failed to create '${name}' inside folder '${parentPathOrId}'`,
      )
    }
    const operation: RefreshOperation = {
      type: 'refresh',
      fileId: parentFolder.id,
      fileName: parentFolder.name,
    }

    let msg = `Created ${dir ? 'directory' : 'file'} [ID: ${newFileNode.id}]${dir ? '' : ' (format: ' + newFileNode.format + ')'} successfully.`
    msg += `\nThe file name has been normalized to '${normalizedName}' to avoid special characters and spaces.`

    return success(msg, [operation])
  } catch (error) {
    return failure(
      getErrorMessage(
        error,
        `Failed to create '${name}' inside folder '${parentPathOrId}'`,
      ),
    )
  }
}

async function executeRenameCommand(
  input: z.infer<typeof renameCommandSchema>,
  session: Session,
): Promise<ToolResult> {
  const { filePathOrId, newName } = input
  const fileRef = await session.resolveFileByPathOrId(filePathOrId)
  if (!fileRef) {
    return failure(`File ${filePathOrId} not found`)
  }
  const response = await fileRef.rename(newName)
  if (!response.ok) {
    return failure(
      response.error ?? `Failed to rename ${filePathOrId} to ${newName}`,
    )
  }
  const operation: RefreshOperation = {
    type: 'refresh',
    fileId: fileRef.id,
    fileName: fileRef.name,
  }
  return success(`Renamed ${filePathOrId} to ${newName} successfully.`, [
    operation,
  ])
}

function normalizeAndValidateName(name: string) {
  const normalizedName = normalizeFileName(name)
  if (!normalizedName) {
    throw new Error('Invalid file name')
  }

  return normalizedName
}

function buildContent(
  strategy: 'overwrite' | 'append',
  currentContent: string,
  newContent: string,
): string {
  if (strategy === 'overwrite') {
    return newContent
  } else if (strategy === 'append') {
    return currentContent + ' ' + newContent
  }
  return currentContent
}

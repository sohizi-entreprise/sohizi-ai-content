import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import type { ToolResult } from "./tool-definition";
import { writeCommandSchema, patchCommandSchema, deleteCommandSchema, moveCommandSchema, copyCommandSchema, createCommandSchema, renameCommandSchema } from "./command-schema";
import { FileObject } from "@/features/file-system/objects/file";
import * as fileSystemRepo from "@/features/file-system/repo";
import { normalizeFileName } from "@/features/file-system/utils";
import { failure, success, resolveFileByPathOrId } from "./utils";
import { getErrorMessage } from "@/utils/get-error-message";

const toolSchema = z.discriminatedUnion('cmd', [
    writeCommandSchema,
    patchCommandSchema,
    deleteCommandSchema,
    moveCommandSchema,
    copyCommandSchema,
    createCommandSchema,
    renameCommandSchema
]);

type OverwriteOperation = {
    type: 'overwrite';
    content: string;
    fileId: string;
}

type PatchOperation = {
    type: 'patch';
    oldText: string;
    newText: string;
    replaceAll: boolean;
    fileId: string;
}

type RefreshOperation = {
    type: 'refresh';
    fileId: string | null;
}

type WriteOperation = OverwriteOperation | PatchOperation;

export const editFileTool = buildBaseTool({
    name: "editFile",
    description: "Performs modifications on the file system such as creating, deleting, moving and renaming file/directory, writing to file, pactching content, copying file content.",
    inputSchema: z.object({
        command: toolSchema,
    }),
    execute: async(input, {session}) => {
        const command = input.command;
        switch (command.cmd) {
            case 'write':
                return executeWriteCommand(command, session.projectId);
            case 'patch':
                return executePatchCommand(command, session.projectId);
            case 'delete':
                return executeDeleteCommand(command, session.projectId);
            case 'move':
                return executeMoveCommand(command, session.projectId);
            case 'copy':
                return executeCopyCommand(command, session.projectId);
            case 'create-file':
                return executeCreateCommand(command, session.projectId);
            case 'rename':
                return executeRenameCommand(command, session.projectId);
            default:
                return failure(`Invalid command received. Valid commands are: write, patch, delete, move, copy, create-file.`);
        }
    }
});

async function executeWriteCommand(input: z.infer<typeof writeCommandSchema>, projectId: string) {
    const { filePathOrId, content, strategy } = input;
    const result = await resolveFileByPathOrId(filePathOrId, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }

    const fileObjectRef = result;

    if(fileObjectRef.isDirectory){
        return failure(`Cannot write to directory.`);
    }

    const operation: WriteOperation = {
        type: 'overwrite',
        content,
        fileId: fileObjectRef.id,
    };
    // TODO: stream the operation to the user

    return success(`Content written and send to the user for approval. The user will see the content and can approve or reject the change. Do not repeat the content in your response, they will see it directly on the editor.`);
}

async function executePatchCommand(input: z.infer<typeof patchCommandSchema>, projectId: string) {
    const { filePathOrId, oldText, newText, replaceAll } = input;
    const result = await resolveFileByPathOrId(filePathOrId, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }

    const fileObjectRef = result;

    if(fileObjectRef.isDirectory){
        return failure(`Cannot patch directory.`);
    }

    const operation: PatchOperation = {
        type: 'patch',
        oldText,
        newText,
        replaceAll,
        fileId: fileObjectRef.id,
    };

    return success(`Content patched and send to the user for approval. The user will see the content and can approve or reject the change. Do not repeat the content in your response, they will see it directly on the editor.`);
}

async function executeDeleteCommand(input: z.infer<typeof deleteCommandSchema>, projectId: string): Promise<ToolResult> {
    const { filePathOrId } = input;
    const result = await resolveFileByPathOrId(filePathOrId, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }

    const fileObjectRef = result;

    if (fileObjectRef.isRoot) {
        return failure('Cannot target the root directory directly.');
    }

    const response = await fileObjectRef.delete();
    if (!response.ok) {
        return failure(response.error ?? `Failed to delete file ${filePathOrId}`);
    }
    const parent = await fileObjectRef.getParent();
    if (!parent){
        return failure(`Failed to delete file ${filePathOrId} because the parent directory is not found.`);
    }
    const operation: RefreshOperation = {
        type: 'refresh',
        fileId: parent.id,
    };

    return success(`Deleted file ${filePathOrId} successfully.`);
}

async function executeMoveCommand(input: z.infer<typeof moveCommandSchema>, projectId: string): Promise<ToolResult> {
    const { fileIdOrPath, newParentPathOrId, position, newName } = input;
    const result = await resolveFileByPathOrId(fileIdOrPath, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }

    const fileRef = result;

    if(fileRef.isRoot){
        return failure(`Cannot move root directory.`);
    }

    const resultNewParent = await resolveFileByPathOrId(newParentPathOrId, projectId);
    if(!(resultNewParent instanceof FileObject)){
        return resultNewParent;
    }

    const newParentRef = resultNewParent;
    let anchorId: string | null = null;
    if(position.anchorFilePathOrId){
        const anchorResult = await resolveFileByPathOrId(position.anchorFilePathOrId, projectId);
        if(!(anchorResult instanceof FileObject)){
            return anchorResult;
        }
        anchorId = anchorResult.id;
    }

    const currentParent = await fileRef.getParent();
    if(!currentParent){
        return failure(`Failed to move ${fileIdOrPath} because the current parent is not found.`);
    }
    const response = await fileRef.moveTo(
        newParentRef,
        position.insertMode,
        anchorId,
        newName,
    );
    if (!response.ok) {
        return failure(response.error ?? `Failed to move ${fileIdOrPath} to ${newParentPathOrId}`);
    }
    
    const operation: RefreshOperation[] = [
        {
            type: 'refresh',
            fileId: currentParent.id,
        },
        {
            type: 'refresh',
            fileId: newParentRef.id,
        },
    ];

    return success(`Moved ${fileIdOrPath} to ${newParentPathOrId} successfully.`);

}

async function executeCopyCommand(input: z.infer<typeof copyCommandSchema>, projectId: string): Promise<ToolResult> {
    const { fromPathOrId, toPathOrId } = input;
    
    const resultFromFile = await resolveFileByPathOrId(fromPathOrId, projectId);
    if(!(resultFromFile instanceof FileObject)){
        return resultFromFile;
    }

    const sourceFileRef = resultFromFile;
    const resultFromTarget = await resolveFileByPathOrId(toPathOrId, projectId);
    if(!(resultFromTarget instanceof FileObject)){
        return resultFromTarget;
    }
    const targetFileRef = resultFromTarget;

    const response = await sourceFileRef.copyTo(targetFileRef);
    if (!response.ok) {
        return failure(response.error ?? `Failed to copy ${fromPathOrId} to ${toPathOrId}`);
    }

    const operations: RefreshOperation[] = [
        {
            type: 'refresh',
            fileId: sourceFileRef.id,
        },
        {
            type: 'refresh',
            fileId: targetFileRef.id,
        },
    ];

    return success(`Copied content from ${fromPathOrId} to ${toPathOrId} successfully.`);
}


async function executeCreateCommand(input: z.infer<typeof createCommandSchema>, projectId: string): Promise<ToolResult> {
    const { parentPathOrId, dir, name, position } = input;

    try {
        const result = await resolveFileByPathOrId(parentPathOrId, projectId);
        if(!(result instanceof FileObject)){
            return result;
        }
        const parentFolder = result;

        if(!parentFolder.isDirectory){
            return failure(`Parent path "${parentPathOrId}" is not a directory.`);
        }
        const parentId = parentFolder.id;

        const normalizedName = normalizeAndValidateName(name);
        let anchorId: string | null = null;

        if(position.anchorFilePathOrId){
            const anchorResult = await resolveFileByPathOrId(position.anchorFilePathOrId, projectId);
            if(!(anchorResult instanceof FileObject)){
                return anchorResult;
            }
            anchorId = anchorResult.id;
        }

        const newFileNode = await fileSystemRepo.createFileWithContentAtPosition(
            projectId,
            {
                projectId,
                name: normalizedName,
                directory: dir,
                parentId,
                position: 0,
                editable: true,
                format: 'markdown'
            },
            anchorId,
            position.insertMode,
        )

        if(!newFileNode){
            return failure(`Failed to create '${name}' inside folder '${parentPathOrId}'`);
        }
        

        return success(`Created ${dir ? 'directory' : 'file'} [ID: ${newFileNode.id}]${dir ? '' : ' (format: ' + newFileNode.format + ')'} successfully.`);
    } catch (error) {
        return failure(getErrorMessage(error, `Failed to create '${name}' inside folder '${parentPathOrId}'`));
    }
}

async function executeRenameCommand(input: z.infer<typeof renameCommandSchema>, projectId: string): Promise<ToolResult> {
    const { filePathOrId, newName } = input;
    const result = await resolveFileByPathOrId(filePathOrId, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }
    const fileRef = result;

    const response = await fileRef.rename(newName);
    if (!response.ok) {
        return failure(response.error ?? `Failed to rename ${filePathOrId} to ${newName}`);
    }
    const operation: RefreshOperation = {
        type: 'refresh',
        fileId: fileRef.id,
    };
    return success(`Renamed ${filePathOrId} to ${newName} successfully.`);
}

function normalizeAndValidateName(name: string) {
    const normalizedName = normalizeFileName(name);
    if (!normalizedName) {
        throw new Error('Invalid file name');
    }

    return normalizedName;
}

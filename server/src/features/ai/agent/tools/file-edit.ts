import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import type { ToolResult } from "./tool-definition";
import { writeCommandSchema, patchCommandSchema, deleteCommandSchema, moveCommandSchema, copyCommandSchema, createCommandSchema, renameCommandSchema } from "./command-schema";
import { FileObject } from "@/features/file-system/objects/file";
import * as fileSystemRepo from "@/features/file-system/repo";
import { normalizeFileName } from "@/features/file-system/utils";
import { failure, success, resolveFileByPathOrId } from "./utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { PatchOperation, RefreshOperation } from "@/type";
import { Session } from "../core/session";

const toolSchema = z.discriminatedUnion('cmd', [
    writeCommandSchema,
    patchCommandSchema,
    deleteCommandSchema,
    moveCommandSchema,
    copyCommandSchema,
    createCommandSchema,
    renameCommandSchema
]);


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
                return executeWriteCommand(command, session);
            case 'patch':
                return executePatchCommand(command, session);
            case 'delete':
                return executeDeleteCommand(command, session);
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

async function executeWriteCommand(input: z.infer<typeof writeCommandSchema>, session: Session) {
    const { filePathOrId, content, strategy } = input;
    const result = await resolveFileByPathOrId(filePathOrId, session.projectId);
    if(!(result instanceof FileObject)){
        return result;
    }

    const fileObjectRef = result;

    if(fileObjectRef.isDirectory){
        return failure(`Cannot write to directory.`);
    }
    if(fileObjectRef.format === null){
        return failure(`The file format is corrupted. You cannot write to it.`);
    }

    const currentContent = await session.getFileContent(fileObjectRef.id, fileObjectRef.format);

    let finalContent = currentContent ?? '';

    if(strategy === 'overwrite'){
        finalContent = content;
    } else if(strategy === 'append'){
        finalContent = currentContent + ' ' + content;
    }
    

    const operation: PatchOperation = {
        type: 'patch',
        content: finalContent,
        fileId: fileObjectRef.id,
        fileName: fileObjectRef.name,
    };

    await fileSystemRepo.upsertPendingFileOperation(session.projectId, fileObjectRef.id, operation);

    // We update the file cache to make sure that the next read operation will use the latest content.
    session.updateFileCache(fileObjectRef.id, finalContent);


    const message = `Content written and send to the user for approval. The user will see the content and can approve or reject the change. Do not repeat the content in your response, they will see it directly on the editor.`

    return success(message, [operation]);
}

async function executePatchCommand(input: z.infer<typeof patchCommandSchema>, session: Session) {
    const { filePathOrId, oldText, newText, replaceAll } = input;
    const result = await resolveFileByPathOrId(filePathOrId, session.projectId);
    if(!(result instanceof FileObject)){
        return result;
    }

    const fileObjectRef = result;

    if(fileObjectRef.isDirectory){
        return failure(`Cannot patch directory.`);
    }
    if(fileObjectRef.format === null){
        return failure(`The file format is corrupted. You cannot patch it.`);
    }

    const currentContent = await session.getFileContent(fileObjectRef.id, fileObjectRef.format);
    let finalContent = currentContent ?? '';
    if(replaceAll){
        finalContent = finalContent.replaceAll(oldText, newText);
    }else{
        finalContent = finalContent.replace(oldText, newText);
    }

    const operation: PatchOperation = {
        type: 'patch',
        content: finalContent,
        fileName: fileObjectRef.name,
        fileId: fileObjectRef.id,
    };
    
    await fileSystemRepo.upsertPendingFileOperation(session.projectId, fileObjectRef.id, operation);
    
    // We update the file cache to make sure that the next read operation will use the latest content.
    session.updateFileCache(fileObjectRef.id, finalContent);

    const msg = `Content patched and send to the user for approval. The user will see the content and can approve or reject the change. Do not repeat the content in your response, they will see it directly on the editor.`

    return success(msg, [operation]);
}

async function executeDeleteCommand(input: z.infer<typeof deleteCommandSchema>, session: Session): Promise<ToolResult> {
    const { filePathOrId } = input;
    const result = await resolveFileByPathOrId(filePathOrId, session.projectId);
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
        fileName: parent.name,
    };

    // We update the file cache to make sure that the next read operation will use the latest content.
    session.updateFileCache(fileObjectRef.id, null);

    return success(`Deleted file ${filePathOrId} successfully.`, [operation]);
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
            fileName: currentParent.name,
        },
        {
            type: 'refresh',
            fileId: newParentRef.id,
            fileName: newParentRef.name,
        },
    ];

    return success(`Moved ${fileIdOrPath} to ${newParentPathOrId} successfully.`, operation);

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
    ];

    return success(`Copied content from ${fromPathOrId} to ${toPathOrId} successfully.`, operation);
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
        const operation: RefreshOperation = {
            type: 'refresh',
            fileId: parentFolder.id,
            fileName: parentFolder.name,
        };

        return success(`Created ${dir ? 'directory' : 'file'} [ID: ${newFileNode.id}]${dir ? '' : ' (format: ' + newFileNode.format + ')'} successfully.`, [operation]);

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
        fileName: fileRef.name,
    };
    return success(`Renamed ${filePathOrId} to ${newName} successfully.`, [operation]);
}

function normalizeAndValidateName(name: string) {
    const normalizedName = normalizeFileName(name);
    if (!normalizedName) {
        throw new Error('Invalid file name');
    }

    return normalizedName;
}

import { z } from "zod";
import { fileFormat } from "@/features/file-system/constants";
import {
    createFileNode as createFileNodeFn,
} from "@/features/file-system/functions";
import { buildBaseTool } from "./tool-definition";
import type { ToolResult } from "./tool-definition";
import { writeCommandSchema, patchCommandSchema, deleteCommandSchema, moveCommandSchema, copyCommandSchema, createCommandSchema } from "./command-schema";
import { FileObject } from "@/features/file-system/objects/file";
import { PathObject } from "@/features/file-system/objects/path";
import * as fileSystemRepo from "@/features/file-system/repo";
import { normalizeFileName } from "@/features/file-system/utils";
import type { FileNodeInsertPosition } from "@/features/file-system/payload";
import { failure, success } from "./utils";
import { getErrorMessage } from "@/utils/get-error-message";

const toolSchema = z.discriminatedUnion('cmd', [
    writeCommandSchema,
    patchCommandSchema,
    deleteCommandSchema,
    moveCommandSchema,
    copyCommandSchema,
    createCommandSchema,
]);

export const editFileTool = buildBaseTool({
    name: "editFile",
    description: "Performs modifications on the file system such as creating file/directory, writing to file, pactching content, deleting file/directory, moving file/directory, copying file content.",
    inputSchema: toolSchema,
    execute: async(input, {session}) => {
        switch (input.cmd) {
            case 'write':
                return executeWriteCommand(input, session.projectId);
            case 'patch':
                return executePatchCommand(input, session.projectId);
            case 'delete':
                return executeDeleteCommand(input, session.projectId);
            case 'move':
                return executeMoveCommand(input, session.projectId);
            case 'copy':
                return executeCopyCommand(input, session.projectId);
            case 'create':
                return executeCreateCommand(input, session.projectId);
        }
    }
});

async function executeWriteCommand(input: z.infer<typeof writeCommandSchema>, projectId: string) {
    const { filepath, content } = input;
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(filepath, projectId);
    if (!fileObject) {
        return failure(`File ${filepath} not found`);
    }

    const response = await fileObject.writeContent({ content });
    if (!response.ok) {
        return failure(response.error ?? `Failed to write content to ${filepath}`);
    }

    return success(`Content written to ${filepath} successfully. Do not repeat the content in your response, the user will see it directly.`);
}

async function executePatchCommand(input: z.infer<typeof patchCommandSchema>, projectId: string) {
    const { filepath, oldText, newText, replaceAll } = input;
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(filepath, projectId);
    if (!fileObject) {
        return failure(`File ${filepath} not found`);
    }

    const response = await fileObject.patchContent({ oldText, newText, replaceAll });
    if (!response.ok) {
        return failure(response.error ?? `Failed to patch content in ${filepath}`);
    }

    return success(`Content patched in ${filepath} successfully. Do not repeat the content in your response, the user will see it directly.`);
}

async function executeDeleteCommand(input: z.infer<typeof deleteCommandSchema>, projectId: string): Promise<ToolResult> {
    const { filepath } = input;
    const pathObject = new PathObject();
    const { fileObject, isRoot } = await pathObject.resolveByPath(filepath, projectId);
    if (isRoot) {
        return failure('Cannot target the root directory directly.');
    }
    if (!fileObject) {
        return failure(`File ${filepath} not found`);
    }

    const response = await fileObject.delete();
    if (!response.ok) {
        return failure(response.error ?? `Failed to delete ${filepath}`);
    }

    return success(`Deleted ${filepath} successfully.`);
}

async function executeMoveCommand(input: z.infer<typeof moveCommandSchema>, projectId: string): Promise<ToolResult> {
    const { oldPath, newPath, position } = input;
    const pathObject = new PathObject();
    const { fileObject: sourceFile, isRoot: isSourceRoot } = await pathObject.resolveByPath(oldPath, projectId);
    if (isSourceRoot) {
        return failure('Cannot target the root directory directly.');
    }
    if (!sourceFile) {
        return failure(`File ${oldPath} not found`);
    }

    try {
        const { parentPath, name } = pathObject.splitParentAndName(newPath);
        const { fileObject: destinationDirectory, isRoot: isDestinationRoot } = await pathObject.resolveDirectoryByPath(parentPath, projectId);
        if (!isDestinationRoot && !destinationDirectory) {
            return failure(`Path "${parentPath}" is not found`);
        }

        const normalizedName = normalizeAndValidateName(name);
        const anchorId = await resolveAnchorId(projectId, isDestinationRoot, destinationDirectory, position.anchorFile, position.insertMode);

        const response = await sourceFile.moveTo(
            isDestinationRoot ? null : destinationDirectory,
            position.insertMode,
            anchorId,
            normalizedName,
        );
        if (!response.ok) {
            return failure(response.error ?? `Failed to move ${oldPath}`);
        }

        return success(`Moved ${oldPath} to ${pathObject.buildChildPath(parentPath, normalizedName)} successfully.`);
    } catch (error) {
        return failure(getErrorMessage(error, `Failed to move ${oldPath}`));
    }
}

async function executeCopyCommand(input: z.infer<typeof copyCommandSchema>, projectId: string): Promise<ToolResult> {
    const { fromPath, toPath } = input;
    const pathObject = new PathObject();
    const { fileObject: sourceFile } = await pathObject.resolveByPath(fromPath, projectId);
    if (!sourceFile) {
        return failure(`File ${fromPath} not found`);
    }

    const { fileObject: targetFile } = await pathObject.resolveByPath(toPath, projectId);
    if (!targetFile) {
        return failure(`File ${toPath} not found`);
    }

    const response = await sourceFile.copyTo(targetFile);
    if (!response.ok) {
        return failure(response.error ?? `Failed to copy ${fromPath} to ${toPath}`);
    }

    return success(`Copied content from ${fromPath} to ${toPath} successfully.`);
}

async function executeCreateCommand(input: z.infer<typeof createCommandSchema>, projectId: string): Promise<ToolResult> {
    const { filepath, dir, name, position } = input;

    try {
        const parentPathObject = new PathObject();
        const { fileObject: parentDirectory, isRoot: isParentRoot } = await parentPathObject.resolveDirectoryByPath(filepath, projectId);
        if (!isParentRoot && !parentDirectory) {
            return failure(`Path "${filepath}" is not found`);
        }

        const parentId = isParentRoot ? null : parentDirectory?.id ?? null;
        const normalizedName = normalizeAndValidateName(name);
        const nextPosition = await fileSystemRepo.getNextFileNodePosition(projectId, parentId);

        const createdFileNode = await createFileNodeFn({
            projectId,
            name: normalizedName,
            directory: dir,
            parentId,
            position: nextPosition,
            format: dir ? null : fileFormat.MARKDOWN,
        });

        const createdFile = new FileObject(createdFileNode);
        const anchorId = await resolveAnchorId(
            projectId,
            isParentRoot,
            parentDirectory,
            position.anchorFile,
            position.insertMode,
        );
        if (position.insertMode !== 'end' || anchorId !== null) {
            const moveResponse = await createdFile.moveTo(
                isParentRoot ? null : parentDirectory,
                position.insertMode,
                anchorId,
            );
            if (!moveResponse.ok) {
                return failure(moveResponse.error ?? `Failed to position ${normalizedName} in ${filepath}`);
            }
        }

        return success(`Created ${dir ? 'directory' : 'file'} ${parentPathObject.buildChildPath(filepath, normalizedName)} successfully.`);
    } catch (error) {
        return failure(getErrorMessage(error, `Failed to create ${name} in ${filepath}`));
    }
}


async function resolveAnchorId(
    projectId: string,
    isRoot: boolean,
    parentDirectory: Awaited<ReturnType<PathObject['resolveByPath']>>['fileObject'],
    anchorFile: string | undefined,
    position: FileNodeInsertPosition,
) {
    if (position === 'start' || position === 'end') {
        return null;
    }

    if (!anchorFile) {
        throw new Error(`anchorFile is required when insertMode is ${position}.`);
    }

    const normalizedAnchorFile = normalizeAndValidateName(anchorFile);

    if (isRoot) {
        const anchorNode = await fileSystemRepo.getFileNodeByName(projectId, null, normalizedAnchorFile);
        if (!anchorNode) {
            throw new Error(`Anchor file "${anchorFile}" was not found in the target directory.`);
        }

        return anchorNode.id;
    }

    if (!parentDirectory) {
        throw new Error('Invalid target directory.');
    }

    const childrenResponse = await parentDirectory.getDirectChildren();
    if (!childrenResponse.ok) {
        throw new Error(childrenResponse.error ?? 'Failed to load target directory children.');
    }

    const anchorNode = childrenResponse.data?.find((child) => child.name === normalizedAnchorFile);
    if (!anchorNode) {
        throw new Error(`Anchor file "${anchorFile}" was not found in the target directory.`);
    }

    return anchorNode.id;
}

function normalizeAndValidateName(name: string) {
    const normalizedName = normalizeFileName(name);
    if (!normalizedName) {
        throw new Error('Invalid file name');
    }

    return normalizedName;
}
import { BadRequest, Conflict, InternalServerError, NotFound } from '../error';
import * as projectRepo from '../project/repo';
import { fileFormat } from './constants';
import {
    FileSystemConflictError,
    FileSystemInputError,
    FileSystemNotFoundError,
    FileSystemOperationError,
    createFileNode as createFileNodeFn,
    deleteFileNode as deleteFileNodeFn,
    getFileContent as getFileContentFn,
    searchDirectoryContent as searchDirectoryContentFn,
    semanticSearchDirectory as semanticSearchDirectoryFn,
    updateFileContent as updateFileContentFn,
    updateFileNode as updateFileNodeFn,
} from './functions';
import { FileCreationRequest, UpdateFileRequest, UpdateTextFileContentRequest } from './payload';
import * as fileSystemRepo from './repo';
import { normalizeFileName } from './utils';
import { ProseDocument } from 'zSchemas';
import { E5SmallLocalEmbedder } from '@/lib/rag/local-embedder';

// List file trees -> ok
// rename file
// reorder files
// move
// delete -> ok
// create file/directory -> ok
// get file content -> ok


export const createFileNode = async(data: FileCreationRequest) => {
    try {
        return await createFileNodeFn(data);
    } catch (error) {
        if (error instanceof FileSystemConflictError || error instanceof FileSystemInputError) {
            throw new BadRequest(error.message);
        }
        console.error(error);
        throw new InternalServerError('Something went wrong');
    }
}

export const deleteFileNode = async(projectId: string, fileId: string) => {
    try {
        await deleteFileNodeFn(projectId, fileId);
    } catch (error) {
        if (error instanceof FileSystemOperationError) {
            throw new BadRequest(error.message);
        }
        console.error(error);
        throw new InternalServerError('Something went wrong');
    }

    return { ok: true, data: fileId };
}

type CompactTextDiff = {
    version: 1;
    baseLength: number;
    targetLength: number;
    edits: Array<{
        start: number;
        deleteCount: number;
        insert: string;
    }>;
}

export const updateFileContent = async(projectId: string, fileNodeId: string, data: UpdateTextFileContentRequest) => {
    try {
        if (data.diff) {
            const fileContent = await getFileContentFn(projectId, fileNodeId);
            const baseRevision = data.baseRevision;

            if (baseRevision === undefined) {
                throw new FileSystemInputError('baseRevision is required when diff is provided');
            }
            if (fileContent.revision !== baseRevision) {
                throw new Conflict('File content changed before diff could be applied');
            }

            const content = applyCompactTextDiff(fileContent.content ?? '', data.diff);
            const updated = await fileSystemRepo.updateFileContentAtRevision(
                projectId,
                fileNodeId,
                { content },
                baseRevision,
            );

            if (!updated) {
                throw new Conflict('File content changed before diff could be applied');
            }

            return updated;
        }

        return await updateFileContentFn(projectId, fileNodeId, { content: data.content ?? '' });
    } catch (error) {
        if (error instanceof Conflict) {
            throw error;
        }
        if (error instanceof FileSystemInputError) {
            throw new BadRequest(error.message);
        }
        if (error instanceof FileSystemOperationError) {
            throw new InternalServerError(error.message);
        }
        console.error(error);
        throw new InternalServerError('Something went wrong');
    }
}

function applyCompactTextDiff(content: string, diff: CompactTextDiff) {
    if (diff.version !== 1) {
        throw new FileSystemInputError('Unsupported diff version');
    }
    if (content.length !== diff.baseLength) {
        throw new FileSystemInputError('File content changed before diff could be applied');
    }

    let nextContent = content;

    for (const edit of [...diff.edits].reverse()) {
        const end = edit.start + edit.deleteCount;

        if (edit.start > nextContent.length || end > nextContent.length) {
            throw new FileSystemInputError('Diff edit is out of bounds');
        }

        nextContent = `${nextContent.slice(0, edit.start)}${edit.insert}${nextContent.slice(end)}`;
    }

    if (nextContent.length !== diff.targetLength) {
        throw new FileSystemInputError('Diff target length does not match applied content');
    }

    return nextContent;
}

export const listFileTreePerLevel = async(projectId: string, parentId: string) => {

    const fileNode = await fileSystemRepo.getFileNodeById(projectId, parentId);
    if (!fileNode) {
        throw new NotFound('File not found');
    }
    if (!fileNode.directory) {
        throw new BadRequest('Parent is not a directory');
    }
    return fileSystemRepo.listDirectoryFiles(projectId, parentId);
}

export const getFileContent = async(projectId: string, fileNodeId: string) => {
    const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileNodeId);
    if (!fileNode) {
        throw new NotFound('File not found');
    }
    if (fileNode.directory) {
        throw new BadRequest('File is a directory');
    }

    let fileContent;
    try {
        fileContent = await getFileContentFn(projectId, fileNodeId);
    } catch (error) {
        if (error instanceof FileSystemNotFoundError) {
            throw new NotFound(error.message);
        }
        throw error;
    }

    switch (fileNode.format) {
        case fileFormat.JSON:
            return {content: fileContent.jsonContent, revision: fileContent.revision};
        default:{
            const content = fileContent.content ?? "";

            return {content, revision: fileContent.revision};
        }
    }
}

// ==============================

export const semanticSearch = async(
    request: { projectId: string; fileNodeId: string; query: string; limit?: number },
) => {
    await validateProject(request.projectId);
    const embedder = new E5SmallLocalEmbedder();
    return semanticSearchDirectoryFn(request, embedder);
}

export const searchFileContent = async(
    request: { projectId: string; fileNodeId: string; keyword: string; limit?: number },
) => {
    await validateProject(request.projectId);
    return searchDirectoryContentFn(request);
}

export const updateFileNode = async(projectId: string, request: UpdateFileRequest) => {
    await validateProject(projectId);
    try {
        return await updateFileNodeFn(projectId, request);
    } catch (error) {
        if (error instanceof FileSystemConflictError || error instanceof FileSystemInputError) {
            throw new BadRequest(error.message);
        }
        if (error instanceof FileSystemNotFoundError) {
            console.log(error.message);
            throw new NotFound(error.message);
        }
        if (error instanceof FileSystemOperationError) {
            throw new InternalServerError(error.message);
        }
        throw error;
    }
}

async function validateProject(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    return project;
}
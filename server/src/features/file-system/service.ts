import { BadRequest, InternalServerError, NotFound } from '../error';
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
    listDirectoryFiles as listDirectoryFilesFn,
    searchDirectoryContent as searchDirectoryContentFn,
    semanticSearchDirectory as semanticSearchDirectoryFn,
    updateFileContent as updateFileContentFn,
    updateFileNode as updateFileNodeFn,
} from './functions';
import { FileCreationRequest, UpdateFileRequest } from './payload';
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

export const updateFileContent = async(projectId: string, fileNodeId: string, data: {content: string}) => {
    try {
        return await updateFileContentFn(projectId, fileNodeId, data);
    } catch (error) {
        if (error instanceof FileSystemOperationError) {
            throw new InternalServerError(error.message);
        }
        console.error(error);
        throw new InternalServerError('Something went wrong');
    }
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
            return {content: fileContent.jsonContent};
        default:{
            const content = fileContent.content ?? "";

            return {content};
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
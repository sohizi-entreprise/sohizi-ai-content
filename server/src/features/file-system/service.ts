import { BadRequest, Conflict, InternalServerError, NotFound } from '../error';
import * as projectRepo from '../project/repo';
import { FileFormat, fileFormat } from './constants';
import {
    FileSystemConflictError,
    FileSystemInputError,
    FileSystemNotFoundError,
    FileSystemOperationError,
    createFileNode as createFileNodeFn,
    deleteFileNode as deleteFileNodeFn,
    getFileContent as getFileContentFn,
    searchProjectContent as searchProjectContentFn,
    semanticSearchDirectory as semanticSearchDirectoryFn,
    updateFileContent as updateFileContentFn,
    updateFileNode as updateFileNodeFn,
} from './functions';
import { FileCreationRequest, UpdateFileRequest, UpdateSkillRequest, UpdateTextFileContentRequest } from './payload';
import * as fileSystemRepo from './repo';
import * as mediaRepo from '../media-engine/repo';
import { E5SmallLocalEmbedder } from '@/lib/rag/local-embedder';
import { ingestFileContentChunks } from './ingest-file-content-chunks';
import { Asset } from '@/db/schema';
import * as storage from '../media-engine/storage';
import { CursorPaginationOptions } from '@/type';
import * as videoEditorRepo from '../video-editor/repo';

// List file trees -> ok
// rename file
// reorder files
// move
// delete -> ok
// create file/directory -> ok
// get file content -> ok


export const createFileNode = async(data: FileCreationRequest) => {
    try {
        const fileNode = await createFileNodeFn(data);
        if (!data.directory && data.format === fileFormat.MARKDOWN) {
            await ingestFileContentChunks({
                projectId: data.projectId,
                fileNodeId: fileNode.id,
                content: '',
            });
        }
        return fileNode;
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
        const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileId);
        if (!fileNode) {
            throw new NotFound('File not found');
        }
        if (!fileNode.editable) {
            throw new BadRequest('Cannot delete a built-in file');
        }
        const assetFormats: Partial<FileFormat>[] = [fileFormat.AUDIO, fileFormat.VIDEO, fileFormat.IMAGE, fileFormat.DOCUMENT]
        const isAssetFile = !fileNode.directory && assetFormats.includes(fileNode.format!);
        let asset: Asset | null = null;
        if(isAssetFile) {
            asset = await mediaRepo.getAssetByFileNodeId(projectId, fileId);
        }
        const isDeleted = await fileSystemRepo.deleteFileNode(projectId, fileId);
        if (!isDeleted) {
            throw new InternalServerError('Failed to delete file. Try again later.');
        }
        if(asset) {
            // The asset will be deleted by the cascade delete of the file node
            // Delete the asset from the bucket - fire and forget
            storage.deleteFile(asset.storageKey);
        }
        return { ok: true, data: fileId };
        
    } catch (error) {
        if (error instanceof FileSystemOperationError) {
            throw new BadRequest(error.message);
        }
        console.error(error);
        throw new InternalServerError('Something went wrong');
    }
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

            await ingestFileContentChunks({
                projectId,
                fileNodeId,
                content: updated.content ?? content,
            });

            return updated;
        }

        const updatedFileContent = await updateFileContentFn(projectId, fileNodeId, { content: data.content ?? '' });
        if (data.diffApplied) {
            await fileSystemRepo.markPendingFileOperationDiffApplied(fileNodeId);
        }
        return updatedFileContent;
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

export const getFileContent = async(projectId: string, fileNodeId: string, paginationOptions?: CursorPaginationOptions) => {
    const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileNodeId);
    if (!fileNode) {
        throw new NotFound('File not found');
    }
    if (fileNode.directory) {
        throw new BadRequest('File is a directory');
    }

    switch (fileNode.format) {
        case fileFormat.MARKDOWN:{
            const textContent = await fileSystemRepo.getFileContentById(projectId, fileNodeId);
            if (!textContent) {
                throw new NotFound('File content not found');
            }
            return {type: 'markdown',content: textContent.content, revision: textContent.revision};
        }
        case fileFormat.AUDIO:
        case fileFormat.VIDEO:
        case fileFormat.IMAGE:
        case fileFormat.DOCUMENT: {
            const asset = await mediaRepo.getAssetByFileNodeId(projectId, fileNodeId);
            return {type: asset.type, url: asset.url, name: asset.name, metadata: asset.metadata, storageKey: asset.storageKey};
        }
        case fileFormat.AI_GENERATED: {
            const aiGeneratedAssets = await mediaRepo.getAiGeneratedAssetsGroupedByGenerationRequest(projectId, paginationOptions);
            return {type: 'ai-generated-assets', data: aiGeneratedAssets.data, nextCursor: aiGeneratedAssets.nextCursor, hasMore: aiGeneratedAssets.hasMore};
        }
        case fileFormat.SKILL: {
            const skill = await fileSystemRepo.getSkillByFileID(fileNodeId);
            if (!skill) {
                throw new NotFound('Skill not found');
            }
            return {type: 'skill', data: skill};
        }
        case fileFormat.VIDEO_EDITOR:{
            const videoEditor = await videoEditorRepo.getFullCompositionByFileNodeId(fileNodeId);
            if (!videoEditor) {
                throw new NotFound('Video editor not found');
            }
            return {type: 'video-editor', data: videoEditor};
        }
        default:
            throw new BadRequest('Unsupported file format');
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
    request: { projectId: string; keyword: string; limit?: number },
) => {
    await validateProject(request.projectId);
    return searchProjectContentFn(request);
}

export const searchFilesByName = async(
    request: { projectId: string; name: string; limit?: number },
) => {
    await validateProject(request.projectId);
    return fileSystemRepo.searchFileNodesByName(request.projectId, request.name, request.limit ?? 15);
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
            console.error(error.message);
            throw new NotFound(error.message);
        }
        if (error instanceof FileSystemOperationError) {
            throw new InternalServerError(error.message);
        }
        throw error;
    }
}

// ======= SKILLS content management ================================

export const getSkillByFileID = async(projectId: string, fileId: string) => {
    await validateProject(projectId);

    const skill = await fileSystemRepo.getSkillByFileID(fileId);
    if (!skill) {
        throw new NotFound('Skill not found');
    }
    return skill;
}

export const updateSkill = async(projectId: string, fileId: string, request: UpdateSkillRequest) => {
    await validateProject(projectId);
    const skill = await fileSystemRepo.updateSkill(fileId, request);
    if (!skill) {
        throw new NotFound('Skill not found');
    }
    return skill;
}

// ============================== PENDING FILE OPERATIONS ==============================

export const listPendingFileOperations = async(projectId: string) => {
    await validateProject(projectId);
    return fileSystemRepo.listPendingFileOperations(projectId);
}

export const getPendingFileOperation = async(projectId: string, fileNodeId: string) => {
    await validateProject(projectId);
    const pendingOperation = await fileSystemRepo.getPendingFileOperation(fileNodeId);
    return {
        operation: pendingOperation,
    }
}

export const deletePendingFileOperation = async(projectId: string, fileNodeId: string) => {
    await validateProject(projectId);
    return {
        ok: await fileSystemRepo.deletePendingFileOperation(fileNodeId),
    }
}

// ============================== HELPER FUNCTIONS ==============================
async function validateProject(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    return project;
}
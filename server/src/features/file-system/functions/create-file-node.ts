import type { FileCreationRequest, UpdateFileContentRequest } from '../payload';
import * as projectRepo from '../../project/repo';
import { MAX_FILE_DEPTH, MAX_FILE_IN_DIRECTORY } from '../constants';
import * as fileSystemRepo from '../repo';
import { normalizeFileName } from '../utils';
import { FileSystemConflictError, FileSystemInputError, FileSystemNotFoundError } from './base';

const EMPTY_FILE_CONTENT: UpdateFileContentRequest = {
    content: '',
    jsonContent: {},
    proseContent: { type: 'doc', content: [] },
};

export const createFileNode = async(
    data: FileCreationRequest,
    content: UpdateFileContentRequest = EMPTY_FILE_CONTENT,
) => {
    if (data.parentId) {
        const parentFileNode = await fileSystemRepo.getFileNodeById(data.projectId, data.parentId);
        if (!parentFileNode || !parentFileNode.directory) {
            throw new FileSystemInputError('Invalid parent directory');
        }

        const parentDepth = await fileSystemRepo.getFileNodeDepthById(data.projectId, data.parentId);
        if (parentDepth === null) {
            throw new FileSystemInputError('Invalid parent directory');
        }
        if (parentDepth + 1 > MAX_FILE_DEPTH) {
            throw new FileSystemInputError(`Maximum file depth of ${MAX_FILE_DEPTH} exceeded`);
        }
    }

    const siblingFiles = await fileSystemRepo.listDirectoryFiles(data.projectId, data.parentId ?? null);
    if (siblingFiles.length >= MAX_FILE_IN_DIRECTORY) {
        throw new FileSystemInputError(`Maximum file count of ${MAX_FILE_IN_DIRECTORY} exceeded in this directory`);
    }

    const normalizedName = normalizeFileName(data.name);
    if (!normalizedName) {
        throw new FileSystemInputError('Invalid file name');
    }

    const payload = { ...data, name: normalizedName };

    if (data.directory) {
        const fileNode = await fileSystemRepo.createFileNode(payload);
        if (!fileNode) {
            throw new FileSystemConflictError('File name already exists in that parent directory.');
        }
        return fileNode;
    }

    const fileNode = await fileSystemRepo.createFileWithContent(data.projectId, payload, content);
    if (!fileNode) {
        throw new FileSystemConflictError('File name already exists in that parent directory.');
    }
    return fileNode;
}

import type { FileNode } from '@/db/schema';
import { MAX_FILE_DEPTH, MAX_FILE_IN_DIRECTORY } from '../constants';
import * as fileSystemRepo from '../repo';
import { listDirectoryFiles } from './list-directory-files';
import { FileSystemInputError } from './base';
import { wouldCreateFileNodeCycle } from './would-create-file-node-cycle';

export async function validateMoveTarget(projectId: string, fileNode: FileNode, parentId: string | null) {
    if (parentId !== null) {
        const destinationParent = await fileSystemRepo.getFileNodeById(projectId, parentId);
        if (!destinationParent || !destinationParent.directory) {
            throw new FileSystemInputError('Invalid parent directory');
        }
    }

    const wouldCreateCycle = await wouldCreateFileNodeCycle(projectId, fileNode.id, parentId);
    if (wouldCreateCycle) {
        throw new FileSystemInputError(`Cannot assign parent "${parentId}" because it would create a cycle.`);
    }

    if ((fileNode.parentId ?? null) !== parentId) {
        const destinationSiblings = await listDirectoryFiles(projectId, parentId);
        if (destinationSiblings.length >= MAX_FILE_IN_DIRECTORY) {
            throw new FileSystemInputError(`Maximum file count of ${MAX_FILE_IN_DIRECTORY} exceeded in this directory`);
        }
    }

    const subtreeHeight = fileNode.directory
        ? await fileSystemRepo.getFileNodeSubtreeHeight(projectId, fileNode.id)
        : 0;
    const parentDepth = parentId === null ? -1 : await fileSystemRepo.getFileNodeDepthById(projectId, parentId);

    if (parentDepth === null) {
        throw new FileSystemInputError('Invalid parent directory');
    }

    const nextDepth = parentDepth + 1 + (subtreeHeight ?? 0);
    if (nextDepth > MAX_FILE_DEPTH) {
        throw new FileSystemInputError(`Maximum file depth of ${MAX_FILE_DEPTH} exceeded`);
    }
}
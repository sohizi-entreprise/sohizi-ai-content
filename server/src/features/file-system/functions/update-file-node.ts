import type { UpdateFileRequest } from '../payload';
import * as fileSystemRepo from '../repo';
import {
    FileSystemConflictError,
    FileSystemInputError,
    FileSystemNotFoundError,
    FileSystemOperationError,
} from './base';
import { validateMoveTarget } from './validate-move-target';

export const updateFileNode = async(projectId: string, request: UpdateFileRequest) => {
    if (request.anchorId !== undefined && request.position === undefined) {
        throw new FileSystemInputError('position is required when anchorId is provided.');
    }

    const currentFileNode = await fileSystemRepo.getFileNodeById(projectId, request.id);
    if (!currentFileNode) {
        throw new FileSystemNotFoundError('File not found');
    }

    const nextName = request.name ?? currentFileNode.name;
    const nextParentId = request.parentId === undefined ? currentFileNode.parentId : request.parentId;
    const shouldReorder = request.position !== undefined || request.anchorId !== undefined || nextParentId !== currentFileNode.parentId;

    try {
        if (shouldReorder) {
            await validateMoveTarget(projectId, currentFileNode, nextParentId);
            const updatedFileNode = await fileSystemRepo.moveFileNode(projectId, {
                id: request.id,
                name: nextName,
                parentId: nextParentId,
                anchorId: request.anchorId ?? null,
                position: request.position ?? 'end',
            });

            if (!updatedFileNode) {
                throw new FileSystemOperationError('Failed to update file');
            }

            return updatedFileNode;
        }

        const updatedFileNode = await fileSystemRepo.updateFileNode(projectId, {
            id: request.id,
            ...(request.name === undefined ? {} : { name: request.name }),
            ...(request.parentId === undefined ? {} : { parentId: request.parentId }),
        });

        if (!updatedFileNode) {
            throw new FileSystemOperationError('Failed to update file');
        }

        return updatedFileNode;
    } catch (error) {
        if (error instanceof fileSystemRepo.FileNodeUniqueConstraintError) {
            throw new FileSystemConflictError(error.message);
        }

        if (error instanceof fileSystemRepo.FileNodeInsertionError) {
            throw new FileSystemInputError(error.message);
        }

        throw error;
    }
}

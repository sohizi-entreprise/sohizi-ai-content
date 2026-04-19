import * as fileSystemRepo from '../repo';
import { FileSystemInputError, FileSystemOperationError } from './base';

export const deleteFileNode = async(projectId: string, fileNodeId: string) => {
    const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileNodeId);
    if (!fileNode) {
        throw new FileSystemInputError('File not found');
    }
    if (fileNode.isBuiltIn) {
        throw new FileSystemInputError('Cannot delete a built-in file');
    }

    const isDeleted = await fileSystemRepo.deleteFileNode(projectId, fileNodeId);
    if (!isDeleted) {
        throw new FileSystemOperationError('Failed to delete file');
    }

    return { ok: true as const };
}

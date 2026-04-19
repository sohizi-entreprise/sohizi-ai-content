import type { UpdateFileContentRequest } from '../payload';
import * as fileSystemRepo from '../repo';
import { FileSystemOperationError } from './base';

export const updateFileContent = async(projectId: string, fileNodeId: string, request: UpdateFileContentRequest) => {
    const fileContent = await fileSystemRepo.updateFileContent(projectId, fileNodeId, request);
    if (!fileContent) {
        throw new FileSystemOperationError('Failed to update file content');
    }

    return fileContent;
}

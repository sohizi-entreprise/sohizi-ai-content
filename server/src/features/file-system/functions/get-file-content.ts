import * as fileSystemRepo from '../repo';
import { FileSystemNotFoundError } from './base';

export const getFileContent = async(projectId: string, fileNodeId: string) => {
    const fileContent = await fileSystemRepo.getFileContentById(projectId, fileNodeId);
    if (!fileContent) {
        throw new FileSystemNotFoundError('File content not found');
    }

    return fileContent;
}

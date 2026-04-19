import * as fileSystemRepo from '../repo';

export const listDirectoryFiles = async(projectId: string, parentId: string | null) => {
    return fileSystemRepo.listDirectoryFiles(projectId, parentId);
}

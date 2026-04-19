import * as fileSystemRepo from '../repo';

export const searchDirectoryContent = async(
    request: { projectId: string; fileNodeId: string; keyword: string; limit?: number },
) => {
    const { projectId, fileNodeId, keyword, limit = 20 } = request;
    return fileSystemRepo.searchDirectoryChunksByKeyword(projectId, fileNodeId, keyword, limit);
}

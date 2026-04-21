import * as fileSystemRepo from '../repo';

export const wouldCreateFileNodeCycle = async(
    projectId: string,
    fileNodeId: string,
    parentId: string | null,
) => {
    if (parentId === null) {
        return false;
    }

    return fileSystemRepo.isFileNodeInAncestorChain(projectId, parentId, fileNodeId);
}

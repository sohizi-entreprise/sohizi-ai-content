import * as fileSystemRepo from "../repo"

export const searchProjectContent = async (request: {
  projectId: string
  keyword: string
  limit?: number
}) => {
  const { projectId, keyword, limit = 20 } = request
  return fileSystemRepo.searchProjectChunksByKeyword(projectId, keyword, limit)
}

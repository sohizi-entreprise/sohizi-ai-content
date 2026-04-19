import { EmbedderInterface } from '@/lib/rag';
import * as fileSystemRepo from '../repo';

export const semanticSearchDirectory = async(
    request: { projectId: string; fileNodeId: string; query: string; limit?: number },
    embedder: EmbedderInterface,
) => {
    const { projectId, fileNodeId, query, limit = 20 } = request;
    const queryEmbedding = await embedder.embedQuery(query);
    return fileSystemRepo.semanticSearchDirectoryChunks(projectId, fileNodeId, queryEmbedding, limit);
}

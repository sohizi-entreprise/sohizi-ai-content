import { E5SmallLocalEmbedder } from '@/lib/rag/local-embedder';
import * as fileSystemRepo from './repo';
import { countWords } from './utils';

export type IngestFileContentChunksParams = {
    projectId: string;
    fileNodeId: string;
    content: string;
    embedder?: E5SmallLocalEmbedder;
};

export async function ingestFileContentChunks({
    projectId,
    fileNodeId,
    content,
    embedder = new E5SmallLocalEmbedder(),
}: IngestFileContentChunksParams): Promise<void> {
    const chunks = await embedder.chunkText(content);

    if (chunks.length === 0) {
        await fileSystemRepo.replaceFileContentChunks(projectId, fileNodeId, []);
        return;
    }

    const records = chunks.map((chunkText, chunkIndex) => ({
        chunkIndex,
        chunkText,
        tokenCount: countWords(chunkText),
    }));

    await fileSystemRepo.replaceFileContentChunks(projectId, fileNodeId, records);
}

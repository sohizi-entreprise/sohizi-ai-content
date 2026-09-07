import { splitIntoChunks } from "@/lib/rag/chunker"
import * as fileSystemRepo from "./repo"
import { countWords } from "./utils"

const CHUNK_TARGET_WORDS = 256
const CHUNK_OVERLAP_WORDS = 128

const wordTokenizer = {
  tokenLength: async (text: string) => countWords(text),
}

export type IngestFileContentChunksParams = {
  projectId: string
  fileNodeId: string
  content: string
}

export async function ingestFileContentChunks({
  projectId,
  fileNodeId,
  content,
}: IngestFileContentChunksParams): Promise<void> {
  const chunks = await splitIntoChunks(content, wordTokenizer, {
    targetTokens: CHUNK_TARGET_WORDS,
    overlapTokens: CHUNK_OVERLAP_WORDS,
  })

  if (chunks.length === 0) {
    await fileSystemRepo.replaceFileContentChunks(projectId, fileNodeId, [])
    return
  }

  const records = chunks.map((chunkText, chunkIndex) => ({
    chunkIndex,
    chunkText,
    tokenCount: countWords(chunkText),
  }))

  await fileSystemRepo.replaceFileContentChunks(projectId, fileNodeId, records)
}

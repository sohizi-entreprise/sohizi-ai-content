
export type ChunkHit = {
    id: string;
    fileNodeId: string;
    chunkIndex: number;
    chunkText: string;
    path: string;
    rank?: number;
    distance?: number;
};
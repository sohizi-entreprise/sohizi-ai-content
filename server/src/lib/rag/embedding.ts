export interface EmbedderInterface {
    readonly vectorSize: number;
    readonly model: string;
    readonly chunksize: number;
    embedQuery(text: string): Promise<number[]>;
    embedChunks(texts: string[]): Promise<number[][]>;
    getMetadata(): Record<string, unknown>;
}
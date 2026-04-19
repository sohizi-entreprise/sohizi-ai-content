import { FeatureExtractionPipeline, pipeline, AutoTokenizer, PreTrainedTokenizer } from '@huggingface/transformers';
import { EmbedderInterface } from './embedding';
import { splitIntoChunks } from './chunker';
import { HuggingFaceTokenizer } from './tokenizer';

export class E5SmallLocalEmbedder implements EmbedderInterface {
    readonly vectorSize: number = 384;
    readonly model: string = 'Xenova/multilingual-e5-small';
    readonly chunksize: number = 256;

    private tokenizer = new HuggingFaceTokenizer(this.model, 'passage: ');
    private pipeline: FeatureExtractionPipeline | null = null;

    async embedQuery(text: string): Promise<number[]> {
        const embedder = await this.getPipeline();
        const output = await embedder(
            `query: ${text}`,
            { pooling: 'mean', normalize: true }
        )
        return output.tolist()[0] as number[];
    }

    async embedChunks(texts: string[]): Promise<number[][]> {
        const embedder = await this.getPipeline();
        const output = await embedder(
            texts.map(text => `passage: ${text}`),
            { pooling: 'mean', normalize: true }
        )
        return output.tolist() as number[][];
    }
    
    getMetadata(): Record<string, unknown> {
        return {
            model: this.model,
            vectorSize: this.vectorSize,
            chunksize: this.chunksize,
        };
    }

    async chunkText(text: string): Promise<string[]> {
        const chunks = await splitIntoChunks(text, this.tokenizer, {
            targetTokens: this.chunksize,
            overlapTokens: this.chunksize / 2,
        });
        return chunks;
    }

    private async getPipeline(): Promise<FeatureExtractionPipeline> {
        if (this.pipeline === null) {
            this.pipeline = await pipeline('feature-extraction', this.model);
        }
        return this.pipeline;
    }
}
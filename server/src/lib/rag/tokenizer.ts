import { AutoTokenizer, PreTrainedTokenizer } from "@huggingface/transformers";

export interface TokenizerInterface {
    tokenLength(text: string): Promise<number>;
}

export class HuggingFaceTokenizer implements TokenizerInterface {
    private tokenizer: PreTrainedTokenizer | null = null;
    private model: string;
    private prefix: string;

    constructor(model: string, prefix: string = '') {
        this.model = model;
        this.prefix = prefix;
    }

    async tokenLength(text: string): Promise<number> {
        const tokenizer = await this.getTokenizer();
        return tokenizer.encode(this.prefix + text).length;
    }

    private async getTokenizer(): Promise<PreTrainedTokenizer> {
        if (this.tokenizer === null) {
            this.tokenizer = await AutoTokenizer.from_pretrained(this.model);
        }
        return this.tokenizer;
    }
}
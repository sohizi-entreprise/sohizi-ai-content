type ModelConfig = {
    modelId: string;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

export class Session {
    public readonly modelConfig: ModelConfig;
    public readonly id: string;

    constructor(id: string, modelConfig: ModelConfig) {
        this.id = id;
        this.modelConfig = modelConfig;
    }
}
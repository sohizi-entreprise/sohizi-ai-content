import { EmbedderInterface } from "@/lib/rag";

type ModelConfig = {
    modelId: string;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

export class Session {
    public readonly modelConfig: ModelConfig;
    public readonly id: string;
    public readonly projectId: string;
    public readonly embedder: EmbedderInterface;
    
    constructor(id: string, modelConfig: ModelConfig, projectId: string, embedder: EmbedderInterface) {
        this.id = id;
        this.modelConfig = modelConfig;
        this.projectId = projectId;
        this.embedder = embedder
    }
}
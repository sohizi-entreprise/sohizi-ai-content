import { EmbedderInterface } from "@/lib/rag";
import { Checkpoint, LlmModel } from "@/db/schema";
import { LlmClient } from "../utils/llm-client";
import { AgentState } from "@/type";
import * as repo from '@/features/chat/repo';
import { ModelMessage } from "ai";

export type SessionInitData = {
    sessionId: string;
    model: LlmModel;
    projectId: string;
    conversationId: string;
    embedder: EmbedderInterface;
    checkpoint: Checkpoint;
}

export class Session {
    public readonly model: LlmModel;
    public readonly id: string;
    public readonly projectId: string;
    public readonly embedder: EmbedderInterface;
    public readonly conversationId: string;
    public readonly checkpoint: Checkpoint;
    private messages: ModelMessage[];

    constructor(data: SessionInitData) {
        this.id = data.sessionId;
        this.model = data.model;
        this.projectId = data.projectId;
        this.embedder = data.embedder;
        this.conversationId = data.conversationId;
        this.checkpoint = data.checkpoint;
        this.messages = [];
    }

    get llmClient(): LlmClient {
        return new LlmClient(this.model.apiName, {reasoningEffort: 'medium', reasoningSummary: 'auto',})
    }

    registerMessage(message: ModelMessage | ModelMessage[]) {
        if(Array.isArray(message)){
            this.messages.push(...message);
        }else{
            this.messages.push(message);
        }
    }

    async persistCheckpoint(state: AgentState) {
        const payload = {...state, messages: state.messages.filter((message) => message.role !== 'system')};
        return await repo.insertCheckpoint(this.projectId, this.conversationId, payload);
    }

    async persistMessages() {
        if(this.messages.length === 0) return;
        const response = await repo.createMessagesBulk(this.conversationId, this.messages.map((message) => ({
            role: message.role as 'user' | 'assistant' | 'tool',
            content: message.content,
        })));
        if(response.length !== this.messages.length) {
            throw new Error('Failed to persist messages');
        }
        this.messages = [];
    }

    async persistState(state: AgentState) {
        try {
            await Promise.all([
                this.persistCheckpoint(state),
                this.persistMessages(),
            ]);
        } catch (error) {
            console.error('Failed to persist session state', error);
        }
    }
}
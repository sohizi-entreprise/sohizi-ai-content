import { EmbedderInterface } from "@/lib/rag";
import { Checkpoint, LlmModel } from "@/db/schema";
import { createBillableLlmClient, type BillableLlmClient } from "../utils/llm-client";
import { AgentState } from "@/type";
import * as repo from '@/features/chat/repo';
import { ModelMessage } from "ai";
import { listTools } from "../tools/tool-registry";
import { resolveFileByPathOrId } from "../tools/utils";
import { FileObject } from "@/features/file-system/objects/file";

export type SessionInitData = {
    sessionId: string;
    userId: string;
    organizationId: string;
    model: LlmModel;
    projectId: string;
    conversationId: string;
    embedder: EmbedderInterface;
    checkpoint: Checkpoint;
}

export class Session {
    public readonly model: LlmModel;
    public readonly id: string;
    public readonly userId: string;
    public readonly organizationId: string;
    public readonly projectId: string;
    public readonly embedder: EmbedderInterface;
    public readonly conversationId: string;
    public readonly checkpoint: Checkpoint;
    private messages: ModelMessage[];
    // We need a cache to make sure that the read and write applies to the correct file content.
    private fileCache: Map<string, FileObject>;

    constructor(data: SessionInitData) {
        this.id = data.sessionId;
        this.userId = data.userId;
        this.organizationId = data.organizationId;
        this.model = data.model;
        this.projectId = data.projectId;
        this.embedder = data.embedder;
        this.conversationId = data.conversationId;
        this.checkpoint = data.checkpoint;
        this.messages = [];
        this.fileCache = new Map();
    }

    get billableLlmClient(): BillableLlmClient {
        const tools = listTools();
        return createBillableLlmClient({
            model: this.model,
            modelConfig: { reasoningEffort: 'medium', reasoningSummary: 'auto' },
            tools,
        });
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

    async resolveFileByPathOrId(filePathOrId: string): Promise<FileObject | null> {
        const cachedFile = this.fileCache.get(filePathOrId);
        if(cachedFile !== undefined){
            return cachedFile;
        }
        const result = await resolveFileByPathOrId(filePathOrId, this.projectId);
        if(!result.success){
            return null;
        }
        this.fileCache.set(filePathOrId, result.file);
        return result.file;
    }

    async removeFileFromCache(filePathOrId: string) {
        this.fileCache.delete(filePathOrId);
    }
}
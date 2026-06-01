import { EmbedderInterface } from "@/lib/rag";
import { Checkpoint, LlmModel } from "@/db/schema";
import { createBillableLlmClient, type BillableLlmClient } from "../utils/llm-client";
import { AgentState } from "@/type";
import * as repo from '@/features/chat/repo';
import { ModelMessage } from "ai";
import { listTools } from "../tools/tool-registry";
import * as fileSystemRepo from "@/features/file-system/repo";
import { fileFormat, FileFormat } from "@/features/file-system/constants";
import { formatSkill } from "../tools/utils";

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
    private fileCache: Map<string, string | null>;

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

    async getFileContent(fileId: string, format: FileFormat): Promise<string | null> {
        const cachedContent = this.fileCache.get(fileId);
        if(cachedContent !== undefined){
            return cachedContent;
        }
        let content: string | null = null;
        switch(format){
            case fileFormat.MARKDOWN: {
                const fileContent = await fileSystemRepo.getFileContentById(this.projectId, fileId);
                content = fileContent?.content
                break;
            }
            
            case fileFormat.SKILL: {
                const skill = await fileSystemRepo.getSkillByFileID(fileId);
                if(!skill) {
                    content = null;
                }else{
                    content = formatSkill(skill);
                }
                break;
            }
            case fileFormat.AI_GENERATED:{
                content = 'Reading the content of ai-generated files is not yet supported.';
                break;
            }
            case fileFormat.VIDEO_EDITOR:{
                content = 'This file is a video timeline. Use the `timelineExplore` tool with this file\'s ID to explore the video timeline.';
                break;
            }
            case fileFormat.IMAGE:
            case fileFormat.VIDEO:
            case fileFormat.DOCUMENT:
            case fileFormat.AUDIO:
                content = `You cannot read the ${format} file directly. You need to assign this task to a specialist sub-agent using \`assignTask\` tool.`;
                break;
            
            default:
                content = `You are trying to read the content of a file which format is not supported by this tool.`;
                break;
        }
        this.fileCache.set(fileId, content);
        return content;
    }

    updateFileCache(fileId: string, content: string | null) {
        this.fileCache.set(fileId, content);
    }
}
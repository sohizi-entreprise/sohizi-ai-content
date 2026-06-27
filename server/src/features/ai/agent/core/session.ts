import { LlmModel } from "@/db/schema";
import { resolveFileByPathOrId } from "../tools/utils";
import { FileObject } from "@/features/file-system/objects/file";
import { getModelById } from "@/features/chat/repo";

export type SessionInitData = {
    sessionId: string;
    userId: string;
    organizationId: string;
    projectId: string;
    runId: string;
    conversationId?: string;
}

export class Session {
    public readonly id: string;
    public readonly userId: string;
    public readonly organizationId: string;
    public readonly projectId: string;
    public readonly conversationId: string | undefined;
    public readonly runId: string;
    // We need a cache to make sure that the read and write applies to the correct file content.
    private fileCache: Map<string, FileObject>;
    private modelsCache: Map<string, LlmModel | null>;

    constructor(data: SessionInitData) {
        this.id = data.sessionId;
        this.userId = data.userId;
        this.organizationId = data.organizationId;
        this.projectId = data.projectId;
        this.conversationId = data.conversationId;
        this.runId = data.runId;
        this.fileCache = new Map();
        this.modelsCache = new Map();
    }

    // get billableLlmClient(): BillableLlmClient {
    //     const tools = listTools();
    //     return createBillableLlmClient({
    //         model: this.model,
    //         modelConfig: { reasoningEffort: 'medium', reasoningSummary: 'auto' },
    //         tools,
    //     });
    // }

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

    async resolveModel(modelId: string): Promise<LlmModel | null> {
        const cachedModel = this.modelsCache.get(modelId);
        if(cachedModel !== undefined){
            return cachedModel;
        }
        const model = await getModelById(modelId) || null;
        this.modelsCache.set(modelId, model);
        return model;
    }

    async removeFileFromCache(filePathOrId: string) {
        this.fileCache.delete(filePathOrId);
    }
}
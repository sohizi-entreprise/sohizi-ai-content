import { resolveFileByPathOrId } from "../tools/utils";
import { FileObject } from "@/features/file-system/objects/file";
import { getModelWithVendorBinding, type ResolvedVendorModel } from "@/features/models/repo";
import { getSkillByName } from "@/features/file-system/repo";

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
    private modelsCache: Map<string, ResolvedVendorModel | null>;
    private skillsCache: Map<string, string>;

    constructor(data: SessionInitData) {
        this.id = data.sessionId;
        this.userId = data.userId;
        this.organizationId = data.organizationId;
        this.projectId = data.projectId;
        this.conversationId = data.conversationId;
        this.runId = data.runId;
        this.fileCache = new Map();
        this.modelsCache = new Map();
        this.skillsCache = new Map();
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

    async resolveModel(modelId: string, vendor: string): Promise<ResolvedVendorModel | null> {
        const cacheKey = `${vendor}:${modelId}`;
        const cachedModel = this.modelsCache.get(cacheKey);
        if(cachedModel !== undefined){
            return cachedModel;
        }
        const model = await getModelWithVendorBinding(modelId, vendor);
        this.modelsCache.set(cacheKey, model);
        return model;
    }

    async resolveSkill(skillName: string): Promise<string | null> {
        const cachedSkill = this.skillsCache.get(skillName);
        if(cachedSkill !== undefined){
            return cachedSkill;
        }
        const skill = await getSkillByName(this.projectId, skillName);
        if(!skill) {
            return null;
        }
        this.skillsCache.set(skillName, skill.instructions);
        return skill.instructions;
    }

    async removeFileFromCache(filePathOrId: string) {
        this.fileCache.delete(filePathOrId);
    }
}
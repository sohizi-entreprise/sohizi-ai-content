import { Checkpoint } from "@/db/schema";
import { AgentState, CompleteReason, GenerationRequestStatus } from "@/type";
import * as repo from '@/features/chat/repo';
import { ModelMessage, ToolModelMessage } from "ai";
import { updateGenerationRequest } from "@/features/generation-request/repo";
import { v4 as uuidv4 } from 'uuid';
import { updateAssetRequest } from "@/features/media-engine/repo";


export abstract class Persistence {
    protected messages: ModelMessage[];

    constructor(){
        this.messages = [];
    }

    registerMessage(message: ModelMessage | ModelMessage[]) {
        if(Array.isArray(message)){
            this.messages.push(...message);
        }else{
            this.messages.push(message);
        }
    }

    abstract persist(runtimeState: AgentState): Promise<void>;

    abstract getInitialState(): AgentState | null;

}


export class CheckpointPersistence extends Persistence {
    private readonly checkpoint: Checkpoint;
    private readonly runId: string;

    constructor(checkpoint: Checkpoint, runId: string){
        super();
        this.checkpoint = checkpoint;
        this.runId = runId;
    }

    async persist(runtimeState: AgentState){
        try {
            await Promise.all([
                this.persistCheckpoint(runtimeState),
                this.persistConversationAgentRun(),
            ]);
        } catch (error) {
            console.error('Failed to persist session state', error);
        }finally{
            this.messages = [];
        }
    }

    getInitialState() {
        const state = this.checkpoint.state ?? null;
        return state;
    }

    async persistCheckpoint(state: AgentState) {
        const conversationId = this.checkpoint.conversationId;
        const projectId = this.checkpoint.projectId;
        const payload = {...state, messages: this.messages.filter((message) => message.role !== 'system')};
        return await repo.insertCheckpoint(projectId, conversationId, payload);
    }

    async persistConversationAgentRun() {
        const filteredMessages = this.messages.filter((message) => message.role !== 'system');
        const messages = filteredMessages.map((message) => ({...message, id: uuidv4()}));
        if(filteredMessages.length === 0) return;

        await repo.updateConversationAgentRun(this.runId, { messages });
    }
}

export class MediaGenerationPersistence extends Persistence {
    private readonly requestId: string;

    constructor(requestId: string){
        super();
        this.requestId = requestId;
    }

    async persist(_runtimeState: AgentState){
        const toolResults: ToolModelMessage[] = [];
        for(const message of this.messages){
            if(message.role === 'tool'){
                toolResults.push(message);
            }
        }

        const allMsgs = this.messages.filter((message) => message.role !== 'system' );
        const messages = allMsgs.map((message) => ({...message, id: uuidv4()}));
        try {
            await updateAssetRequest(this.requestId, {
                messages,
            });
        } catch (error) {
            console.error('Failed to persist session state', error);
        }
    }

    getInitialState() {
        return null;
    }
    
}
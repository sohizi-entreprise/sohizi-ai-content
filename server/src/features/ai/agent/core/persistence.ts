import { Checkpoint } from "@/db/schema";
import { AgentState, CompleteReason, GenerationRequestStatus } from "@/type";
import * as repo from '@/features/chat/repo';
import { ModelMessage, ToolModelMessage } from "ai";
import { updateGenerationRequest } from "@/features/generation-request/repo";


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

    constructor(checkpoint: Checkpoint){
        super();
        this.checkpoint = checkpoint;
    }

    async persist(runtimeState: AgentState){
        try {
            await Promise.all([
                this.persistCheckpoint(runtimeState),
                this.persistMessages(),
            ]);
        } catch (error) {
            console.error('Failed to persist session state', error);
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

    async persistMessages() {
        if(this.messages.length === 0) return;
        const conversationId = this.checkpoint.conversationId;
        const response = await repo.createMessagesBulk(conversationId, this.messages.map((message) => ({
            role: message.role as 'user' | 'assistant' | 'tool',
            content: message.content,
        })));
        if(response.length !== this.messages.length) {
            throw new Error('Failed to persist messages');
        }
        this.messages = [];
    }
}

export class MediaGenerationPersistence extends Persistence {
    private readonly requestId: string;

    constructor(requestId: string){
        super();
        this.requestId = requestId;
    }

    async persist(runtimeState: AgentState){
        const toolResults: ToolModelMessage[] = [];
        for(const message of this.messages){
            if(message.role === 'tool'){
                toolResults.push(message);
            }
        }

        const statusMap: Record<CompleteReason, GenerationRequestStatus> = {
            'abort': 'aborted',
            'error': 'failed',
            'stop': 'completed',
            'content-filter': 'completed',
            'length': 'completed',
            'tool-calls': 'completed',
            'other': 'completed'
        }

        const allMsgs = this.messages.filter((message) => message.role !== 'system' );
        
        try {
            await updateGenerationRequest(this.requestId, {
                status: statusMap[runtimeState.finishReason as CompleteReason] || 'completed',
                history: allMsgs,
            });
        } catch (error) {
            console.error('Failed to persist session state', error);
        }
    }

    getInitialState() {
        return null;
    }
    
}
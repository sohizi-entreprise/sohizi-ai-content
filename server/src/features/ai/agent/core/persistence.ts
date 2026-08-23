import { Checkpoint } from "@/db/schema";
import { AgentState, CompleteReason, GenerationRequestStatus } from "@/type";
import * as repo from '@/features/chat/repo';
import { ModelMessage, ToolModelMessage } from "ai";
import { appendRequestHistory } from "@/features/generation-request/repo";
import { v4 as uuidv4 } from 'uuid';


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
        const payload = {...state, messages: state.messages.filter((message) => message.role !== 'system')};
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

        const allMsgs = this.messages.filter((message) => message.role !== 'system' );
        const messages = allMsgs.map((message) => ({...message, id: uuidv4()}));
        if(messages.length === 0) return;
        try {
            await appendRequestHistory(this.requestId, messages);
        } catch (error) {
            console.error('Failed to persist session state', error);
        }
    }

    getInitialState() {
        return null;
    }
    
}
import { BlockSchema } from "../schema";
import { z } from "zod";
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel, ModelMessage, streamText } from "ai";
import { scriptAgentToolDefinitions, scriptAgentToolSet } from "./script-agent-tools";
import { v4 as uuidv4 } from 'uuid';
import { scriptAgentPrompt } from "../prompts/script-agent";
import { StreamBus } from "../stream-bus";
import { ProjectFormat, ProjectRequirements } from "@/type";
import { getWriterPrompt } from "../prompts/writer";
import { getReviewerPrompt } from "../prompts/reviewer";

type Block = z.infer<typeof BlockSchema>;


type ThoughtOutput = {
    outputType: "thought";
    content: string;
}
type ResponseOutput = {
    outputType: "response";
    content: string;
}

type ToolNames = keyof typeof scriptAgentToolSet;
// Helper type to extract input type for a specific tool name
type ToolInputForName<T extends keyof typeof scriptAgentToolSet> = z.infer<typeof scriptAgentToolSet[T]>;

type AgentToolCall = {
    tool: ToolNames;
    args: ToolInputForName<ToolNames>;
}

type ActionOutput = {
    outputType: "action";
    statusUpdate: string;
    toolCalls: AgentToolCall[];
}
type PauseOutput = {
    outputType: "pause";
    statusUpdate: string;
    toolCalls: AgentToolCall[];
}

type ObservationOutput = {
    outputType: "observation";
    content: string;
}

type UserInput = {
    inputType: "USER";
    userInput: string;
}

type ErrorChunk = {
    type: "error";
    source: "agent" | "writer" | "reviewer";
    message: string;
}

type AgentChunk = {
    runId: string;
    type: "chunk" | "complete";
    source: "agent" | "writer" | "reviewer";
    data: string;
}

type BlockChunk = {
    id: string;
    parentId: string;
    content: string;
    type: Block["type"];
    source: "writer";
}

type LlmStreamInput = {
    name: "agent" | "writer" | "reviewer";
    model:LanguageModel;
    messages: ModelMessage[];
    systemPrompt: string;
    abortSignal?: AbortSignal;
    providerOptions?: any;
    useBuffer?: boolean;
}

type EventLog = Array<ThoughtOutput | ResponseOutput | ActionOutput | PauseOutput | ObservationOutput | UserInput>;

type AgentOutput = ThoughtOutput | ResponseOutput | ActionOutput | PauseOutput;

export type ScriptStreamEvent = ErrorChunk | AgentChunk | BlockChunk;


export class ScriptAgent {
    public blocks: Block[];
    public response: ResponseOutput | null;
    private events: EventLog;
    private toDos: string[]; 
    private systemPrompt: string;

    constructor(
        private model: string,
        private streamBus: StreamBus<ScriptStreamEvent>,
        private projectRequirements: ProjectRequirements,
        private abortSignal?: AbortSignal
    ){
        this.systemPrompt = scriptAgentPrompt.replace('__TOOLS__', JSON.stringify(scriptAgentToolDefinitions));
        this.blocks = [];
        this.events = [];
        this.toDos = [];
        this.response = null;
        this.abortSignal = undefined;
        this.streamBus = streamBus;
        this.projectRequirements = projectRequirements;
    }

    async run(prompt: string, maxIteration: number = 20){
        // Register as a producer so the bus doesn't close prematurely
        this.streamBus.addProducer('agent');
        
        try {
            const userEvent: UserInput = {
                inputType: "USER",
                userInput: prompt,
            }
            this.events.push(userEvent);

            for(let i = 0; i < maxIteration; i++){
                if(this.response || this.abortSignal?.aborted){
                    return;
                }
                await this.callModel();
            }
        } finally {
            console.log(this.blocks);
            // End the producer when run() completes
            this.streamBus.endProducer('agent');
        }
    }

    async callModel() {

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        const fullPrompt = `##EVENTS LOOP: \n${JSON.stringify(this.events)}`;

        const messages: ModelMessage[] = [
            {
                role: "user",
                content: this.createUserPrompt(fullPrompt),
            }
        ]

        const params = {
            name: "agent" as const,
            model: openai(this.model),
            messages,
            systemPrompt: this.systemPrompt,
            abortSignal: this.abortSignal,
            providerOptions: {
                openai:{
                    reasoningEffort: "minimal"
                }
            },
            useBuffer: true,
        }

        for await (const chunk of llmStreamer(params)){
            if(chunk.type === "complete"){
                await this.handleAgentOutput(chunk.data);
                return;
            }
            this.streamBus.push(chunk);
            // Ensure the agent sees errors in its event log so it can recover deterministically.
            if (chunk.type === "error") {
                const observation: ObservationOutput = {
                    outputType: "observation",
                    content: `ERROR (${chunk.source}): ${chunk.message}`,
                };
                this.events.push(observation);
                return;
            }
            // yield chunk;
        }

    }

    private createUserPrompt(other: string){
        return `
## PROJECT REQUIREMENTS:
- Format: ${this.projectRequirements.format}
- Audience: ${this.projectRequirements.audience || 'general'}
- Genre: ${this.projectRequirements.genre}
- Tone: ${this.projectRequirements.tone}
- Max Duration: ${this.projectRequirements.maxDuration || '5min'}
- Constraints: ${this.projectRequirements.constraints ? JSON.stringify(this.projectRequirements.constraints) : 'None'}
---

## BLOCKS WRITTEN SO FAR:
${JSON.stringify(this.blocks)}

---

${other}
`
    }

    private async handleAgentOutput(output: string){
        try {
            const jsonData = JSON.parse(output) as AgentOutput;
            this.events.push(jsonData);
            switch(jsonData.outputType){
                case "thought":
                    break;
                case "response":
                    this.response = jsonData;
                    break;
                case "pause":
                case "action":
                    const toolCalls = jsonData.toolCalls
                    await this.executeTool(toolCalls);
                    break;
                default:
                    console.warn(`Unknown output pattern: ${jsonData}`);
                    break;
            }
        } catch (error) {
            console.error(`Error parsing agent output: ${error}. Output: ${output}`);
        }

    }

    private async executeTool(toolCalls: AgentToolCall[]){
        for(const toolCall of toolCalls){
            // Type guard to check if it's a known tool
            const toolName = toolCall.tool;
            
            if (!(toolName in scriptAgentToolSet)) {
                console.warn(`Unknown tool: ${toolName}`);
                continue;
            }
            
            switch (toolName) {
                case "addBlock": {
                    const toolInput = toolCall.args as ToolInputForName<"addBlock">;
                    await this.forwardProducer('addBlock', this.addBlock(toolInput));
                    break;
                }
                case "todoWrite": {
                    const toolInput = toolCall.args as ToolInputForName<"todoWrite">;
                    this.updateTodos(toolInput);
                    break;
                }
                case "updateBlock": {
                    const toolInput = toolCall.args as ToolInputForName<"updateBlock">;
                    await this.forwardProducer('updateBlock', this.addBlock(toolInput));
                    break;
                }
                case "removeBlock": {
                    const toolInput = toolCall.args as ToolInputForName<"removeBlock">;
                    this.deleteBlock(toolInput);
                    break;
                }
                case "reviewBlock": {
                    const toolInput = toolCall.args as ToolInputForName<"reviewBlock">;
                    await this.forwardProducer('reviewBlock', this.reviewBlock(toolInput));
                    break;
                }
                default:
                    // Handle any unexpected tool names
                    const _exhaustive: never = toolName;
                    break;
            }
        }
    }

    /**
     * Forward an async producer to the stream bus AND wait for it to finish.
     * This keeps the agent's event log in sync with tool observations, preventing
     * "action -> model called again before observation" loops.
     */
    private async forwardProducer(
        producerId: string,
        stream: AsyncIterable<ScriptStreamEvent> | AsyncIterator<ScriptStreamEvent>
    ): Promise<void> {
        this.streamBus.addProducer(producerId);
        try {
            const it =
                Symbol.asyncIterator in (stream as any)
                    ? (stream as AsyncIterable<ScriptStreamEvent>)[Symbol.asyncIterator]()
                    : (stream as AsyncIterator<ScriptStreamEvent>);

            while (true) {
                const { value, done } = await it.next();
                if (done) break;
                this.streamBus.push(value);
                if ((value as any)?.type === "error") {
                    const err = value as ErrorChunk;
                    const observation: ObservationOutput = {
                        outputType: "observation",
                        content: `ERROR (${err.source}): ${err.message}`,
                    };
                    this.events.push(observation);
                }
            }
        } finally {
            this.streamBus.endProducer(producerId);
        }
    }

    // Overload signatures (TypeScript doesn't support generator overloads, so we use a union type with type guards)
    private async *addBlock(input: ToolInputForName<"addBlock"> | ToolInputForName<"updateBlock">): AsyncGenerator<ErrorChunk | BlockChunk> {
        // Type guard to determine if this is an addBlock or updateBlock input
        const isAddBlock = (inp: typeof input): inp is ToolInputForName<"addBlock"> => {
            return 'blockType' in inp && 'parentId' in inp;
        };

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        let userPrompt = '';
        let block: Block | null = null;

        if (isAddBlock(input)) {
            userPrompt = input.instruction;
            block = {
                id: uuidv4(),
                parentId: input.parentId,
                content: '',
                type: input.blockType,
            }
        } else {
            userPrompt = (input as ToolInputForName<"updateBlock">).instruction;
            block = this.blocks.find(b => b.id === (input as ToolInputForName<"updateBlock">).blockId) || null;
        }

        if (!block) {
            yield { type: "error", source: "writer", message: `Block not found: ${(input as ToolInputForName<"updateBlock">).blockId}` };
            return;
        }

        const fullContext = isAddBlock(input) ? `## NEW BLOCK TO ADD:\nTYPE: ${input.blockType}\nINSTRUCTION: ${userPrompt}\n---` : `## BLOCK TO UPDATE:\nID: ${block.id}\nINSTRUCTION: ${userPrompt}\n`;

        const messages: ModelMessage[] = [
            {
                role: "user",
                content: this.createUserPrompt(fullContext),
            }
        ]

        const params = {
            name: "writer" as const,
            model: openai("gpt-5-mini"),
            messages,
            systemPrompt: getWriterPrompt(this.projectRequirements.format),
            abortSignal: this.abortSignal,
            providerOptions: {
                openai:{
                    reasoningEffort: "minimal"
                }
            }
        }

        for await (const chunk of llmStreamer(params)){
            if("data" in chunk ){
                switch (chunk.type) {
                    case "chunk":
                        block.content = chunk.data;
                        yield { source: "writer", ...block };
                        break;
                    case "complete":
                        block.content = chunk.data;
                        if(isAddBlock(input)){
                            this.blocks.splice(input.insertIndex, 0, block);
                        }else{
                            this.blocks = this.blocks.map(b => b.id === block.id ? block : b);
                        }
                        // Push an observation event
                        const observation: ObservationOutput = {
                            outputType: "observation",
                            content: `Block ${block.id} written successfully`,
                        }
                        this.events.push(observation);
                        return;
                
                    default:
                        break;
                }
                continue
            }
            yield chunk;
        }
        return;
        
    }

    private async *reviewBlock(toolInput: ToolInputForName<"reviewBlock">): AsyncGenerator<ErrorChunk | AgentChunk> {
        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        const messages: ModelMessage[] = [
            {
                role: "user",
                content: this.createUserPrompt(`## BLOCK TO REVIEW:\nID: ${toolInput.blockId}`)
            }
        ]

        const params = {
            name: "reviewer" as const,
            model: openai("gpt-5-mini"),
            messages,
            systemPrompt: getReviewerPrompt(),
            abortSignal: this.abortSignal,
            providerOptions: {
                openai:{
                    reasoningEffort: "minimal"
                }
            }
        }

        for await (const chunk of llmStreamer(params)){
            if(chunk.type === "complete"){
                const observation: ObservationOutput = {
                    outputType: "observation",
                    content: `FEEDBACK FOR BLOCK ${toolInput.blockId}: ${chunk.data}`,
                }
                this.events.push(observation);
                return;
            }
            yield chunk;
        }
    }

    private deleteBlock({blockId}: ToolInputForName<"removeBlock">){
        this.blocks = this.blocks.filter(b => b.id !== blockId);
        const observation: ObservationOutput = {
            outputType: "observation",
            content: `Block ${blockId} deleted successfully`,
        }
        this.events.push(observation);
    }

    private updateTodos(input: ToolInputForName<"todoWrite">){
        this.toDos = input.tasks;
        const observation: ObservationOutput = {
            outputType: "observation",
            content: `Todos updated successfully`,
        }
        this.events.push(observation);
    }

}


async function* llmStreamer({name, model, messages, systemPrompt, abortSignal, providerOptions, useBuffer=false}: LlmStreamInput): AsyncGenerator<ErrorChunk | AgentChunk > {

    let finalOutput: string = '';
    let runId = uuidv4();
    let buffer: string = '';

    const checkCancelled = (): boolean => abortSignal?.aborted ?? false;

    if (checkCancelled()) {
        yield { type: "error", source: name, message: "Operation cancelled" };
        return;
    }

    try {
        const result = streamText({
            model,
            system: systemPrompt,
            messages,
            maxRetries: 2,
            abortSignal,
            providerOptions,
            onError({error}){
                throw new Error(error instanceof Error ? error.message : `Error occurred: ${String(error)}`)
            },
            onFinish({text, finishReason, totalUsage, toolCalls, response}){
                if(finishReason === "error"){
                    return
                }
                finalOutput = text;
            },
          });

        for await (const chunk of result.textStream){
            buffer += chunk;
            yield { type: "chunk", source: name, runId, data: useBuffer ? buffer : chunk };
        }

        if(!finalOutput){
            yield { type: "error", source: name, message: "No output from writer" };
            return;
        }
        yield { type: "complete", source: name, runId, data: finalOutput };
    } catch (error) {
        yield { type: "error", source: name, message: error instanceof Error ? error.message : String(error) };
    }

}
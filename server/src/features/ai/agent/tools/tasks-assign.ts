import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { getAgentDefinition, supportedAgents } from "../core/agent-registry";
import { success, failure } from "./utils";
import { createCancellableController } from "@/features/generation-request/abort-manager";


const assignTaskInputSchema = z.object({
    subAgent: z.enum(supportedAgents).describe('The specific type of sub-agent required for the job.'),
    instructions: z.string().describe('The instructions for the sub-agent to follow in order to complete the assigned task.'),
})

export const assignTaskTool = buildBaseTool({
    name: "assignTask",
    description: "Delegates a focused, heavy-lifting task to a specialized sub-agent.",
    inputSchema: assignTaskInputSchema,
    execute: async(input, {session}) => {

        const { subAgent, instructions } = input;
        const { controller, cleanup } = await createCancellableController(session.runId);

        try {
            // Lazy import avoids circular init: tasks-assign → agent → tool-registry → tasks-assign
            const { Agent } = await import("../core/agent");
            const agentDefinition = getAgentDefinition(subAgent);
            if(!agentDefinition){
                return failure(`Invalid sub-agent name provided. Supported are ${supportedAgents.join(', ')}`)
            }
    
            const model = await session.resolveModel(agentDefinition.modelId);
            if(!model){
                return failure(`Model not found. The sub-agent ${subAgent} is unvailable right now. Either assign a different sub-agent if possible or return to the user if this is a blocker.`)
            }
    
    
            const agent = new Agent({
                name: agentDefinition.name,
                systemPrompt: agentDefinition.baseSystemPrompt,
                model,
                modelConfig: agentDefinition.modelConfig,
                session,
                maxContextTokens: agentDefinition.maxContextTokens,
                contextThreshold: agentDefinition.contextThreshold,
                summaryModelId: agentDefinition.summaryModelId,
            });
    
            const msg = {
                role: 'user' as const,
                content: instructions
            }
    
            const chunks = agent.runLoop(msg, controller.signal, 100)
    
            let output = '';
    
            for await (const chunk of chunks) {
                if(chunk.type === 'complete'){
                    output = chunk.text
                }
            }
            
            return success(output);
            
        } catch (error) {
            console.error(error);
            if(error instanceof Error){
                return failure(error.message);
            }
            return failure('An unknown error occurred');
        }
        finally {
            cleanup();
        }
    }
})
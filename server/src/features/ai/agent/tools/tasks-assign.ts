import { z } from "zod";
import { buildBaseTool } from "./tool-definition";

const supportedAgents = [
    {
        role: 'writer',
        description: 'Best suited for writing and updating content.',
    },
    {
        role: 'researcher',
        description: 'Best suited for researching data.',
    },
] as const;

const agentRoles = supportedAgents.map((agent) => agent.role);


const assignTaskInputSchema = z.object({
    agentRole: z.enum(agentRoles).describe('The specific type of sub-agent required for the job.'),
    taskObjective: z.string().describe('The primary goal for the sub-agent.'),
    contextData: z.string().describe('The exact background information the sub-agent needs to succeed. Sub-agents do not share your memory! Provide IDs, constraints, and plot points here.'),
    expectedDeliverable: z.string().describe('Strict instructions on what the sub-agent must return to you.')
})

export const assignTaskTool = buildBaseTool({
    name: "assignTask",
    description: getDescription(),
    inputSchema: assignTaskInputSchema,
    execute: async(input) => {
        return {
            success: true,
            output: '',
        }
    }
})

function getDescription() {
    return `
Delegates a focused, heavy-lifting task to a specialized sub-agent. Use this whenever a task requires deep data research, creative writing, or formatting.
Do not attempt to write content or read massive documents yourself. Pass the exact context and expectations to the sub-agent, and wait for their completed response.
`
}
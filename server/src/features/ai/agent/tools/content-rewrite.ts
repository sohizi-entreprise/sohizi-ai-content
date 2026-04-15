import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { availableCategoryKeys } from "../constants/dsl";

const rewriteContentInputSchema = z.object({
    category: z.enum(availableCategoryKeys).describe("The category of the existing content to rewrite"),
    format: z.enum(['json', 'fountain']).describe('The format to create the content in.'),
    targetId: z.string().describe('The exact ID of the entity you are overwriting'),
    jsonData: z.json().optional().describe('The complete, new JSON object that will replace the old one. ONLY provide this if format is json'),
    fountainText: z.string().optional().describe('The complete, new Fountain text that will replace the old one. ONLY provide this if format is fountain'),
})

export const rewriteContentTool = buildBaseTool({
    name: "rewriteContent",
    description: "Completely overwrites an existing piece of production content. Use this when the user explicitly asks to 'rewrite entirely', 'start over', or when the requested changes are so massive that a surgical patch is impossible.",
    inputSchema: rewriteContentInputSchema,
    execute: async(input) => {
        return {
            success: true,
            output: 'Content created successfully.',   
        }
    }
} );
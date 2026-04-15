import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { availableCategoryKeys } from "../constants/dsl";

const createContentInputSchema = z.object({
    category: z.enum(availableCategoryKeys).describe("The category of the content being created"),
    format: z.enum(['json', 'fountain']).describe('The data format of the content'),
    jsonData: z.json().optional().describe("The complete JSON object representing the content. ONLY provide this if format is json. Follow the category's SCHEMA"),
    fountainText: z.string().optional().describe('The raw Fountain-formatted text. ONLY provide this if format is fountain'),
    insertMode: z.enum(['end', 'start', 'after', 'before']).describe('Determines where this new content is placed'),
    anchorId: z.string().optional().describe('The ID of the entity to anchor the new content to. Only required if insertMode is after or before'),
})

export const createContentTool = buildBaseTool({
    name: "createContent",
    description: 'Creates a brand new piece of production content from scratch. Use this ONLY when generating a completely new entity (e.g., a new character, a new scene, a new location, etc.)',
    inputSchema: createContentInputSchema,
    execute: async(input) => {
        return {
            success: true,
            output: 'Content created successfully.',   
        }
    }
} );
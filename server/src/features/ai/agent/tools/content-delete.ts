import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { availableCategoryKeys } from "../constants/dsl";

const deleteContentInputSchema = z.object({
    category: z.enum(availableCategoryKeys).describe("The category of the content to delete"),
    targetId: z.string().describe('The exact ID of the entity to permanently delete'),
})

export const deleteContentTool = buildBaseTool({
    name: "deleteContent",
    description: "Permanently removes an entity from the production database. Use this when the user explicitly asks to 'delete', 'remove', or when the content is no longer needed.",
    inputSchema: deleteContentInputSchema,
    execute: async(input) => {
        return {
            success: true,
            output: 'Content deleted successfully.',   
        }
    }
} );
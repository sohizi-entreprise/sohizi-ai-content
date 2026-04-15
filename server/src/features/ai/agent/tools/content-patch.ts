import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { availableCategoryKeys } from "../constants/dsl";

const jsonPatchSchema = z.object({
    category: z.enum(availableCategoryKeys).describe("The category of the content you are patching"),
    patchType: z.literal('json_update').describe('Use json_update for JSON-based categories'),
    targetId: z.string().describe('The exact ID of the entity being modified'),
    jsonPath: z.string().describe('REQUIRED if patch_type is json_update. The exact dot-notation path of the key you are updating'),
    newValue: z.string().describe('REQUIRED if patch_type is json_update. The new value to set at the json_path. Can be a string, array, or object.'),
})

const textPatchSchema = z.object({
    category: z.enum(availableCategoryKeys).describe("The category of the content you are patching"),
    patchType: z.literal('text_replace').describe('Use text_replace for text/Fountain-based categories'),
    targetId: z.string().describe('The exact ID of the entity being modified'),
    oldText: z.string().describe('REQUIRED if patch_type is text_replace. The exact substring currently present in the Fountain document that you want to remove. It must match perfectly'),
    newText: z.string().describe('REQUIRED if patch_type is text_replace. The new substring that will replace the old_text'),
})

const patchContentInputSchema = z.discriminatedUnion('patchType', [jsonPatchSchema, textPatchSchema]);


export const patchContentTool = buildBaseTool({
    name: "patchContent",
    description: "Surgically edits a specific section of an existing document without rewriting the whole thing. This is your primary editing tool. Use this to change a character's trait, update a few lines of dialogue in a scene, or fix a typo.",
    inputSchema: patchContentInputSchema,
    execute: async(input) => {
        return {
            success: true,
            output: 'Content created successfully.',   
        }
    }
} );
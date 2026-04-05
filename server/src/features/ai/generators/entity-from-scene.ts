import { Character, CostumeSchema, CharacterSchema, LocationSchema, PropSchema } from "zSchemas";
import { BaseGeneratorParams, OnUsageUpdateParams } from "../type";
import { SceneContent } from "@/type";
import { formatSceneBlock } from "../utils";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { encode } from "@toon-format/toon";

type Costume = {
    type: 'costume'
    description: string
    wornBy: string
}

export type EntityFromScenePayload = {
    scene: SceneContent[]
    entityList: {type: 'character' | 'location' | 'prop' | 'costume'; id: string; name: string; description: string; wornBy?: string; }[]
}

type EntityExtract = Character | Costume | {type: 'location' | 'object'; name: string; description: string;}

type GenerateEntityParams = BaseGeneratorParams<EntityExtract[], EntityFromScenePayload>;

const OutputSchema = z.discriminatedUnion('type', [
    CharacterSchema.extend({ type: z.literal('character') }), 
    CostumeSchema.extend({ type: z.literal('costume') }), 
    LocationSchema.extend({ type: z.literal('location') }), 
    PropSchema.extend({ type: z.literal('prop') }),
]);

type GenerateEntityResult = {
    entities: z.infer<typeof OutputSchema>[];
    usage: OnUsageUpdateParams;
    error?: string;
};


const LLM_MODEL = 'gpt-5.1';


export async function generateEntityFromScene(
    params: GenerateEntityParams
): Promise<GenerateEntityResult> {
    const {
        payload,
        abortSignal,
        onAbort,
        onError,
        onUsageUpdate,
    } = params;
    const { scene, entityList } = payload;
    const emptyUsage = createUsage();

    if (abortSignal.aborted) {
        await onAbort();
        return {
            entities: [],
            usage: emptyUsage,
            error: "Request aborted",
        };
    }

    try {
        const result = await generateText({
            model: openai(LLM_MODEL),
            output: Output.array({ element: OutputSchema }),
            system: getSystemPrompt(entityList),
            prompt: getUserPrompt(scene),
            abortSignal,
            providerOptions: {
                openai: { reasoningEffort: "low" },
            },
        });

        const usage = createUsage(result.usage);
        await onUsageUpdate(usage);
        if (result.finishReason === "error") {
            await onError(new Error("Entity outline generation failed"));
            return {
                entities: [],
                usage,
                error: "Entity outline generation failed",
            };
        }

        const parsed = result.output
       
        return {
            entities: parsed,
            usage,
        };
    } catch (error) {
        const errorMessage =
            abortSignal.aborted
                ? "Request aborted"
                : error instanceof Error
                  ? error.message
                  : String(error);

        if (abortSignal.aborted) {
            await onAbort();
        } else {
            await onError(error instanceof Error ? error : new Error(errorMessage));
        }

        return {
            entities: [],
            usage: emptyUsage,
            error: errorMessage,
        };
    }
}

function createUsage(
    usage?: Partial<Pick<OnUsageUpdateParams, "totalTokens" | "inputTokens" | "outputTokens">>
): OnUsageUpdateParams {
    return {
        totalTokens: usage?.totalTokens ?? 0,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        model: LLM_MODEL,
    };
}

const getSystemPrompt = (entityList: EntityFromScenePayload['entityList']) => `
You are an expert script supervisor and story development assistant. Your task is to extract key entities (characters, locations, props, and costumes) from a screenplay scene to build a comprehensive story bible.

Goals & Guidelines:
- Identify only the most story-relevant entities from the provided scene.
- Analyze the scene deeply to infer comprehensive details for each entity. For characters, deduce their role, age, physical appearance, personality traits, motivation, and voice based on their actions and dialogue.
- Cross-reference with the provided <entity_list>. If an entity already exists in this list, DO NOT extract it again. Check for variations in naming to prevent duplicates.
- Keep descriptions vivid, concrete, and highly specific.

<entity_list>
${encode(entityList)}
</entity_list>
`;

const getUserPrompt = (scene: SceneContent[]) => `
Carefully read the scene below and extract all NEW key entities (characters, locations, props, and costumes).

Extraction Rules:
1. Characters: Extract characters who actively participate or are clearly described. Use the scene's context to logically deduce their required attributes (traits, motivation, backstory, flaw, voice) if not explicitly stated.
2. Locations: Extract settings from sluglines and action descriptions. Focus on the visual atmosphere, lighting, and key distinguishing features.
3. Props: Extract only significant objects that drive the action, are interacted with, or have narrative weight.
4. Costumes: Extract distinct outfits or wardrobe pieces described in the scene.
5. NO DUPLICATES: Do not return any entity that is already present in the <entity_list>.
6. No hallucinations: Do not invent entities that are not mentioned in the scene.

<target_scene>
${scene.map((block) => formatSceneBlock(block)).join("\n\n")}
</target_scene>
`;
import { EntityFromScenePayload } from "./entity-from-scene";
import { OnUsageUpdateParams } from "../type";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { shotSchema } from "zSchemas";
import { z } from "zod";
import { encode } from "@toon-format/toon";
import { SceneContent } from "@/type";
import { formatSceneBlock } from "../utils";


type Params = {
    payload: {
        scene: SceneContent[];
        entityList: {type: 'character' | 'location' | 'prop' | 'costume'; id: string; name: string; description: string; wornBy?: string; }[];
    }
    abortSignal: AbortSignal;
};
type Result = {
    shots: z.infer<typeof shotSchema>[]; 
    usage: OnUsageUpdateParams;
    stopReason: 'stop' | 'error' | 'abort';
    error?: string;
}

const LLM_MODEL = 'gpt-5.1';

export async function generateShotsFromScene(
    params: Params
): Promise<Result>{

    const { payload: { scene, entityList }, abortSignal } = params;
    const emptyUsage = createUsage();

    if (abortSignal.aborted) {
        return {
            shots: [],
            usage: emptyUsage,
            stopReason: 'abort',
        };
    }

    try {
        const result = await generateText({
            model: openai(LLM_MODEL),
            output: Output.array({ element: shotSchema }),
            system: getSystemPrompt(entityList),
            prompt: getUserPrompt(scene),
            abortSignal,
            providerOptions: {
                openai: { reasoningEffort: "low" },
            },
        });

        const usage = createUsage(result.usage);
        if (result.finishReason === "error") {
            return {
                shots: [],
                usage,
                stopReason: 'error',
                error: "Shots generation failed",
            };
        }

        const parsed = result.output
       
        return {
            shots: parsed,
            usage,
            stopReason: 'stop',
        };
    } catch (error) {
        const errorMessage =
            abortSignal.aborted
                ? "Request aborted"
                : error instanceof Error
                  ? error.message
                  : String(error);

        return {
            shots: [],
            usage: emptyUsage,
            stopReason: abortSignal.aborted ? 'abort' : 'error',
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
You are an expert storyboard artist and cinematographer. Your task is to break down a screenplay scene into a sequential list of highly detailed shots.

Goal:
- Translate the narrative action, dialogue, and emotion of the scene into a sequence of visual shots.
- Use the provided entity list to reference known characters, locations, props, and costumes by their ID.
- Ensure each shot flows logically into the next, maintaining spatial continuity and cinematic pacing.
- For each shot, provide comprehensive visual, camera, and audio details optimized for downstream image/video and audio generation.

<entity_list>
${encode(entityList)}
</entity_list>
`;

const getUserPrompt = (scene: SceneContent[]) => `
Break down the following scene into a sequence of cinematic shots.

Rules:
- Every action and dialogue line from the scene MUST be covered by the sequence of shots.
- Use the entity IDs from the system prompt to link subjects, props, costumes, and environments.
- Keep the actionDescription concise and focused purely on what is visible on screen.
- Distribute dialogue into the speechTracks of the corresponding shots exactly as written in the scene.
- Ensure camera angles, movements, and shot types reflect the emotional beats of the scene.
- Provide descriptive negative prompts and "must keep" constraints to ensure visual consistency.

<target_scene>
${scene.map((block) => formatSceneBlock(block)).join("\n\n")}
</target_scene>
`;
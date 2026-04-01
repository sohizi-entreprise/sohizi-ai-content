import { Output, generateText } from "ai";
import {
    type EntityObject,
    type Outline,
    type StoryBible,
    scriptOutlineSchema,
} from "zSchemas";
import { type ProseDocument } from "@/type";
import { openai } from "@/lib/llm-providers";
import { BaseGeneratorParams, type OnUsageUpdateParams } from "../type";
import { proseDocumentToPlainText } from "../utils";
import { encode } from "@toon-format/toon";

type Payload = {
    storyBible: StoryBible;
    synopsis: ProseDocument;
    entities: EntityObject[];
};

type GenerateScenesOutlineParams = BaseGeneratorParams<Outline, Payload>;

export type GenerateScenesOutlineResult = {
    outline: Outline | null;
    usage: OnUsageUpdateParams;
    error?: string;
};

const SCENES_OUTLINE_MODEL = "gpt-5.1";

export async function generateScenesOutline(
    params: GenerateScenesOutlineParams
): Promise<GenerateScenesOutlineResult> {
    const {
        payload,
        abortSignal,
        onAbort,
        onError,
        onSuccess,
        onUsageUpdate,
    } = params;
    const emptyUsage = createUsage();

    if (abortSignal.aborted) {
        await onAbort();
        return {
            outline: null,
            usage: emptyUsage,
            error: "Request aborted",
        };
    }

    try {
        const result = await generateText({
            model: openai(SCENES_OUTLINE_MODEL),
            output: Output.object({ schema: scriptOutlineSchema }),
            system: buildSceneOutlineSystemPrompt(),
            prompt: getSceneOutlineUserPrompt(payload),
            abortSignal,
            providerOptions: {
                openai: { reasoningEffort: "low" },
            },
        });

        const usage = createUsage(result.usage);
        await onUsageUpdate(usage);

        if (result.finishReason === "error") {
            await onError(new Error("Scene outline generation failed"));
            return {
                outline: null,
                usage,
                error: "Scene outline generation failed",
            };
        }

        const outline = normalizeGeneratedOutline(
            scriptOutlineSchema.parse(JSON.parse(result.text))
        );
        await onSuccess(outline);

        return {
            outline,
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
            outline: null,
            usage: emptyUsage,
            error: errorMessage,
        };
    }
}

function normalizeGeneratedOutline(outline: Outline): Outline {
    let sceneNumber = 1;

    return {
        beats: outline.beats
            .map((beat) => ({
                beat_name: beat.beat_name.trim(),
                summary: beat.summary.trim(),
                scenes: beat.scenes.map((scene) => ({
                    scene_number: sceneNumber++,
                    slugline: scene.slugline.trim(),
                    characters_present: dedupeStrings(scene.characters_present),
                    scene_goal: scene.scene_goal.trim(),
                    action_summary: scene.action_summary.trim(),
                })),
            }))
            .filter((beat) => beat.beat_name && beat.summary && beat.scenes.length > 0),
    };
}

function dedupeStrings(items: string[]) {
    const seen = new Set<string>();

    return items.filter((item) => {
        const normalized = item.trim().toLowerCase();
        if (!normalized || seen.has(normalized)) {
            return false;
        }

        seen.add(normalized);
        return true;
    });
}

function createUsage(
    usage?: Partial<Pick<OnUsageUpdateParams, "totalTokens" | "inputTokens" | "outputTokens">>
): OnUsageUpdateParams {
    return {
        totalTokens: usage?.totalTokens ?? 0,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        model: SCENES_OUTLINE_MODEL,
    };
}

const buildSceneOutlineSystemPrompt = (): string => `
You are a screenplay outlining assistant.

Goal:
- Create a tight, writer-ready script outline from the provided materials.
- Organize the story into beats, each with a concise summary and the scenes that belong to it.
- Make every scene purposeful, dramatic, and clearly connected to the core conflict.

Rules:
- Base the outline strictly on the synopsis, story bible, and provided entities.
- Do not introduce major story elements that are not supported by the material.
- Keep the structure concise and production-friendly.
- Avoid filler scenes, repetitive beats, and vague scene purposes.

Requirements:
- Write an outline, not prose.
- Use sluglines in this format: INT./EXT. LOCATION - TIME.
- Keep beat summaries to 1-2 tight sentences.
- Keep scene_goal and action_summary concise, specific, and dramatic.
- Ensure each scene has a clear purpose within its beat.
- Prefer scenes that both advance plot and reveal character.
- Start scenes late, end early, and make sure something changes.
- Number scenes sequentially across the full script.
- Return only valid JSON with no markdown or commentary.
`;

function getSceneOutlineUserPrompt(payload: Payload) {
    const { storyBible, synopsis, entities } = payload;

    return `
Generate a complete script outline first, then it will be used to write the scenes.

Important:
- Be concise and practical.
- Create only story-relevant beats and scenes.
- Keep the structure tight and production-friendly.
- Each beat needs a short summary.
- Each scene must have a clear goal and a concise action summary.

<entities>
${encode(entities)}
</entities>

<story_bible>
${encode(storyBible)}
</story_bible>

<synopsis>
${proseDocumentToPlainText(synopsis)}
</synopsis>
`;
}
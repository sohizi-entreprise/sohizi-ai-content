import { Project } from "@/db/schema";
import { SystemPromptBuilder } from "../prompts/promptBuilder";
import { streamText } from "ai";
import { openai } from "@/lib/llm-providers";
import { ResumableStream, StreamEvent } from "@/lib";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

/** Script outline (15-beat sheet with scene cards). Same shape as script-generator output. */
export type ScriptOutlinePayload = {
    beats: Array<{
        beat_name: string;
        scenes: Array<{
            scene_number: number;
            slugline: string;
            characters_present: string[];
            scene_goal: string;
            conflict_obstacle: string;
            action_summary: string;
            emotional_shift: string;
            story_engine_output: string;
        }>;
    }>;
};

type Params = {
    project: Project;
    outline: ScriptOutlinePayload;
    /** e.g. "Shot on 35mm anamorphic, neon-noir, high contrast, moody, cinematic" */
    visualStyleReference?: string;
    onStart: () => void | Promise<void>;
    onFinish: (shotLists: SceneShotList[], totalUsage: number) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
    stream: ResumableStream;
};

// ---------------------------------------------------------------------------
// Scene outline (input: same as script outline scenes)
// ---------------------------------------------------------------------------

const sceneOutlineSchema = z.object({
    scene_number: z.number(),
    slugline: z.string().min(1),
    characters_present: z.array(z.string()),
    scene_goal: z.string(),
    conflict_obstacle: z.string(),
    action_summary: z.string(),
    emotional_shift: z.string(),
    story_engine_output: z.string(),
});

type SceneOutline = z.infer<typeof sceneOutlineSchema>;

// ---------------------------------------------------------------------------
// Shot list schema (output)
// ---------------------------------------------------------------------------

const aiVisualParametersSchema = z.object({
    shot_size: z.string(),
    camera_angle: z.string(),
    subject_description: z.string(),
    environment_background: z.string(),
    lighting_and_atmosphere: z.string(),
    camera_lens_and_style: z.string(),
});

const aiVideoMotionParametersSchema = z.object({
    camera_movement: z.string(),
    subject_movement: z.string(),
});

const readyToUsePromptsSchema = z.object({
    image_generation_prompt: z.string(),
    video_generation_prompt: z.string(),
});

const shotSchema = z.object({
    shot_id: z.string(),
    narrative_action: z.string(),
    audio_or_dialogue: z.string(),
    estimated_duration_seconds: z.number(),
    ai_visual_parameters: aiVisualParametersSchema,
    ai_video_motion_parameters: aiVideoMotionParametersSchema,
    ready_to_use_prompts: readyToUsePromptsSchema,
});

const sceneShotListSchema = z.object({
    scene_shot_list: z.object({
        scene_number: z.number(),
        slugline: z.string(),
        overall_mood: z.string(),
        shots: z.array(shotSchema),
    }),
});

/** One scene's shot list (single object with scene_shot_list key) */
export type SceneShotListPayload = z.infer<typeof sceneShotListSchema>;

/** Flattened: array of scene_shot_list inner objects for convenience */
export type SceneShotList = SceneShotListPayload["scene_shot_list"];

/** Batch response: array of 1 or 2 scene shot list objects */
const batchResponseSchema = z.array(sceneShotListSchema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function batch<T>(arr: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        batches.push(arr.slice(i, i + size));
    }
    return batches;
}

function flattenScenes(
    outline: ScriptOutlinePayload
): { beat_name: string; scene: SceneOutline }[] {
    const result: { beat_name: string; scene: SceneOutline }[] = [];
    for (const beat of outline.beats) {
        for (const scene of beat.scenes) {
            result.push({ beat_name: beat.beat_name, scene });
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export async function shotGenerator({
    project,
    outline,
    visualStyleReference = "Shot on 35mm anamorphic, cinematic, moody, high contrast.",
    onStart,
    onFinish,
    onError,
    onAbort,
    stream,
}: Params) {
    const runId = uuidv4();

    if (!project.story_bible) {
        const errorMessage = "Story bible is required before generating shots";
        await stream.push({
            type: "shot_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        onError(new Error(errorMessage));
        return;
    }

    await onStart();

    const abortController = new AbortController();
    let totalUsage = 0;

    try {
        await stream.push({ type: "shot_start", data: { runId } });

        const flatScenes = flattenScenes(outline);
        const sceneBatches = batch(flatScenes, 2);
        const allShotLists: SceneShotList[] = [];

        for (let batchIndex = 0; batchIndex < sceneBatches.length; batchIndex++) {
            if (await stream.isCancelled()) {
                abortController.abort();
                await stream.close();
                onAbort();
                return;
            }

            const batchItems = sceneBatches[batchIndex];
            let batchJsonBuffer = "";

            const shotResponse = streamText({
                model: openai("gpt-5.1"),
                system: buildShotListSystemPrompt(),
                prompt: getShotListUserPrompt(
                    project,
                    batchItems,
                    visualStyleReference
                ),
                abortSignal: abortController.signal,
                providerOptions: { openai: { reasoningEffort: "low" } },
                onFinish: ({ totalUsage: u }) => {
                    totalUsage += u?.totalTokens ?? 0;
                },
            });

            for await (const chunk of shotResponse.fullStream) {
                if (await stream.isCancelled()) {
                    abortController.abort();
                    await stream.close();
                    onAbort();
                    return;
                }

                let event: StreamEvent<unknown> | null = null;
                switch (chunk.type) {
                    case "text-delta":
                        batchJsonBuffer += chunk.text;
                        break;
                    case "reasoning-delta":
                        event = {
                            type: "shot_delta",
                            data: { runId, type: "reasoning", text: chunk.text },
                        };
                        break;
                    case "finish": {
                        try {
                            const parsed = JSON.parse(batchJsonBuffer) as unknown;
                            const arr = batchResponseSchema.parse(parsed);
                            if (arr.length === 0 || arr.length > 2) {
                                throw new Error(
                                    `Expected 1–2 scene shot lists, got ${arr.length}`
                                );
                            }
                            const batchShotLists: SceneShotList[] = arr.map(
                                (item) => item.scene_shot_list
                            );
                            for (const sl of batchShotLists) {
                                allShotLists.push(sl);
                            }
                            event = {
                                type: "shot_delta",
                                data: {
                                    runId,
                                    step: "shot_list",
                                    batchIndex,
                                    sceneCount: arr.length,
                                    payload: batchShotLists,
                                },
                            };
                        } catch (parseError) {
                            const errMsg =
                                parseError instanceof Error
                                    ? parseError.message
                                    : String(parseError);
                            onError(new Error(`Shot batch parse error: ${errMsg}`));
                            event = {
                                type: "shot_error",
                                data: {
                                    runId,
                                    error: `Failed to parse shot batch: ${errMsg}`,
                                },
                            };
                            await stream.push(event);
                            await stream.close();
                            return;
                        }
                        break;
                    }
                    case "error": {
                        const errMsg =
                            chunk.error instanceof Error
                                ? chunk.error.message
                                : String(chunk.error);
                        event = {
                            type: "shot_error",
                            data: { runId, error: errMsg },
                        };
                        onError(new Error(errMsg));
                        break;
                    }
                    default:
                        break;
                }
                if (event) await stream.push(event);
            }
        }

        await onFinish(allShotLists, totalUsage);
    } catch (error) {
        const errMsg =
            error instanceof Error ? error.message : String(error);
        onError(error instanceof Error ? error : new Error(errMsg));
        await stream.push({
            type: "shot_error",
            data: { runId, error: errMsg },
        });
    } finally {
        await stream.push({ type: "shot_end", data: { runId } });
        await stream.close();
    }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const CINEMATOGRAPHER_IDENTITY = `You are an expert Cinematographer, Storyboard Artist, and AI Prompt Engineer.

Your task: Break each provided scene down into a chronological sequence of individual shots. Output strictly valid JSON using the exact structure requested. Do not include any text outside of the JSON.

Make visual descriptions incredibly rich, focusing on cinematic terminology, lighting, atmosphere, and motion, so the data can be directly fed into AI image and video generators (e.g. Midjourney, DALL-E, Runway Gen-2, Pika, Sora).`;

function buildShotListSystemPrompt(): string {
    const shotListJsonSchema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                scene_shot_list: {
                    type: "object",
                    properties: {
                        scene_number: { type: "number" },
                        slugline: { type: "string" },
                        overall_mood: { type: "string" },
                        shots: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    shot_id: { type: "string" },
                                    narrative_action: { type: "string" },
                                    audio_or_dialogue: { type: "string" },
                                    estimated_duration_seconds: { type: "number" },
                                    ai_visual_parameters: {
                                        type: "object",
                                        properties: {
                                            shot_size: { type: "string" },
                                            camera_angle: { type: "string" },
                                            subject_description: { type: "string" },
                                            environment_background: {
                                                type: "string",
                                            },
                                            lighting_and_atmosphere: {
                                                type: "string",
                                            },
                                            camera_lens_and_style: {
                                                type: "string",
                                            },
                                        },
                                        required: [
                                            "shot_size",
                                            "camera_angle",
                                            "subject_description",
                                            "environment_background",
                                            "lighting_and_atmosphere",
                                            "camera_lens_and_style",
                                        ],
                                    },
                                    ai_video_motion_parameters: {
                                        type: "object",
                                        properties: {
                                            camera_movement: { type: "string" },
                                            subject_movement: { type: "string" },
                                        },
                                        required: [
                                            "camera_movement",
                                            "subject_movement",
                                        ],
                                    },
                                    ready_to_use_prompts: {
                                        type: "object",
                                        properties: {
                                            image_generation_prompt: {
                                                type: "string",
                                            },
                                            video_generation_prompt: {
                                                type: "string",
                                            },
                                        },
                                        required: [
                                            "image_generation_prompt",
                                            "video_generation_prompt",
                                        ],
                                    },
                                },
                                required: [
                                    "shot_id",
                                    "narrative_action",
                                    "audio_or_dialogue",
                                    "estimated_duration_seconds",
                                    "ai_visual_parameters",
                                    "ai_video_motion_parameters",
                                    "ready_to_use_prompts",
                                ],
                            },
                        },
                    },
                    required: [
                        "scene_number",
                        "slugline",
                        "overall_mood",
                        "shots",
                    ],
                },
            },
            required: ["scene_shot_list"],
        },
    };

    return new SystemPromptBuilder()
        .addIdentity(CINEMATOGRAPHER_IDENTITY)
        .addOutputFormat(
            `Output a JSON array of exactly 1 or 2 items (one per scene in this batch). Each item is an object with a single key "scene_shot_list" whose value has: scene_number, slugline, overall_mood, and shots (array of shot objects). Each shot has: shot_id (e.g. "1.1", "1.2"), narrative_action, audio_or_dialogue, estimated_duration_seconds, ai_visual_parameters (shot_size, camera_angle, subject_description, environment_background, lighting_and_atmosphere, camera_lens_and_style), ai_video_motion_parameters (camera_movement, subject_movement), ready_to_use_prompts (image_generation_prompt, video_generation_prompt). Return only valid JSON, no markdown.\n${JSON.stringify(shotListJsonSchema)}`
        )
        .build();
}

function getShotListUserPrompt(
    project: Project,
    batchItems: { beat_name: string; scene: SceneOutline }[],
    visualStyleReference: string
): string {
    const sceneContext = batchItems
        .map(
            (item) =>
                `Scene ${item.scene.scene_number} (${item.beat_name}): ${item.scene.slugline}
  Goal: ${item.scene.scene_goal}
  Conflict: ${item.scene.conflict_obstacle}
  Action: ${item.scene.action_summary}
  Emotional shift: ${item.scene.emotional_shift}
  Characters: ${item.scene.characters_present.join(", ")}`
        )
        .join("\n\n");

    return `
Break each of the following ${batchItems.length} scene(s) down into a chronological sequence of individual shots. Output a JSON array with exactly ${batchItems.length} object(s). Each object must have one key "scene_shot_list" containing: scene_number, slugline, overall_mood (brief description of the scene's visual atmosphere), and shots (array of shot objects).

For each shot provide:
- shot_id: e.g. "1.1", "1.2" (scene_number.shot_index)
- narrative_action: What is happening in the story for this shot
- audio_or_dialogue: Brief note on sound effects or dialogue during this shot
- estimated_duration_seconds: Typical shot length in seconds (e.g. 3–6)
- ai_visual_parameters: shot_size (e.g. Extreme Close-Up, Medium Shot, Wide Shot), camera_angle (e.g. Low angle, Dutch angle, Eye-level), subject_description (highly detailed: clothing, expression, pose), environment_background, lighting_and_atmosphere (e.g. volumetric fog, rim light, golden hour), camera_lens_and_style (e.g. 50mm, shallow DOF, anamorphic flare)
- ai_video_motion_parameters: camera_movement (e.g. slow push in, static, handheld tracking), subject_movement (e.g. walks toward camera, hair blowing)
- ready_to_use_prompts: image_generation_prompt (comma-separated, optimized for Midjourney/Stable Diffusion), video_generation_prompt (optimized for Runway/Sora)

Visual Style Reference: ${visualStyleReference}

Scenes to break into shots:
${sceneContext}

Story bible (for character and world consistency):
\`\`\`json
${JSON.stringify(project.story_bible)}
\`\`\`

Return only the JSON array, no other text.
`;
}

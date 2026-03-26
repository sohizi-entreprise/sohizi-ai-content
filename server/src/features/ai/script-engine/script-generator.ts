import { Project } from "@/db/schema";
import { SystemPromptBuilder } from "../prompts/promptBuilder";
import { identities } from "../prompts";
import { skills } from "../skills";
import { ResumableStream } from "@/lib";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { scriptOutlineSchema, type Outline as ScriptOutline, type SceneOutline, sceneContentSchema } from "zSchemas";
import type { SceneContent } from "@/type";
import { streamLLMStep, streamLLMBatch } from "./stream-llm";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// const sceneOutlineSchema = z.object({
//     scene_number: z.number(),
//     slugline: z.string().min(1),
//     characters_present: z.array(z.string()),
//     scene_goal: z.string(),
//     action_summary: z.string(),
// });

// const beatSchema = z.object({
//     beat_name: z.string().min(1),
//     scenes: z.array(sceneOutlineSchema),
// });

// const scriptOutlineSchema = z.object({
//     beats: z.array(beatSchema),
// });

export type { SceneOutline, ScriptOutline };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BaseParams = {
    project: Project;
    stream: ResumableStream;
    onStart?: () => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
};

type ScriptOutlineParams = BaseParams & {
    onFinish: (outline: ScriptOutline, totalUsage: number) => void | Promise<void>;
};

type SceneDevelopmentParams = BaseParams & {
    /** The script outline (provides scenes to develop) */
    scriptOutline: ScriptOutline;
    /** Batch size for scene development (default: 3) */
    batchSize?: number;
    onFinish: (scenes: SceneContent[][], totalUsage: number) => void | Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten all scenes from beats into a single list, preserving beat_name for context */
function flattenScenes(outline: ScriptOutline): { beat_name: string; scene: SceneOutline }[] {
    const result: { beat_name: string; scene: SceneOutline }[] = [];
    for (const beat of outline.beats) {
        for (const scene of beat.scenes) {
            result.push({ beat_name: beat.beat_name, scene });
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Generate Script Outline (15-beat sheet with scene cards)
// ---------------------------------------------------------------------------

const FIFTEEN_BEATS = [
    "Opening Image",
    "Theme Stated",
    "Setup",
    "Catalyst",
    "Debate",
    "Break into Two",
    "B Story",
    "Fun and Games",
    "Midpoint",
    "Bad Guys Close In",
    "All Is Lost",
    "Dark Night of the Soul",
    "Break into Three",
    "Finale",
    "Final Image",
];

/**
 * Generates the script outline using the 15 Beat Sheet structure.
 * Each beat contains scene cards with goals, conflicts, and action summaries.
 * This is an independent step that can be called separately.
 */
export async function generateScriptOutline({
    project,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: ScriptOutlineParams) {
    const runId = uuidv4();
    const abortController = new AbortController();

    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    if (!selectedArc) {
        const errorMessage = "You must select a narrative arc before generating a script outline";
        await stream.push({
            type: "script_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    if (!project.synopsis) {
        const errorMessage = "Synopsis is required before generating a script outline";
        await stream.push({
            type: "script_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    if (!project.story_bible) {
        const errorMessage = "Story bible is required before generating a script outline";
        await stream.push({
            type: "script_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    try {
        await stream.push({ type: "script_start", data: { runId } });

        const result = await streamLLMStep({
            systemPrompt: buildOutlineSystemPrompt(),
            userPrompt: getOutlineUserPrompt(project),
            schema: scriptOutlineSchema,
            stream,
            runId,
            abortSignal: abortController.signal,
            deltaEventType: "script_delta",
            errorEventType: "script_error",
            stepName: "outline",
            onStart,
            onFinish,
            onError,
            onAbort,
            streamTextDeltas: true,
            streamReasoningDeltas: true,
        });

        if (result.aborted) {
            abortController.abort();
            await stream.close();
            await onAbort();
            return;
        }

        if (result.error) {
            await onError(new Error(result.error));
            await stream.push({
                type: "script_error",
                data: { runId, error: result.error },
            });
            await stream.close();
            return;
        }

        if (!result.result) {
            await onError(new Error("Script outline did not produce valid output"));
            await stream.push({
                type: "script_error",
                data: { runId, error: "Script outline did not produce valid output" },
            });
            await stream.close();
            return;
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await onError(error instanceof Error ? error : new Error(errMsg));
        await stream.push({
            type: "script_error",
            data: { runId, error: errMsg },
        });
    } finally {
        await stream.push({ type: "script_end", data: { runId } });
        await stream.close();
    }
}

// ---------------------------------------------------------------------------
// Generate Scenes (batches of scenes from outline)
// ---------------------------------------------------------------------------

/**
 * Develops full script scenes based on a script outline.
 * Processes scenes in batches and returns screenplay block arrays.
 * This is an independent step that can be called separately.
 */
export async function generateScenes({
    project,
    scriptOutline,
    batchSize = 3,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: SceneDevelopmentParams) {
    const runId = uuidv4();
    const abortController = new AbortController();

    if (!project.synopsis) {
        const errorMessage = "Synopsis is required before generating scenes";
        await stream.push({
            type: "scene_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    if (!project.story_bible) {
        const errorMessage = "Story bible is required before generating scenes";
        await stream.push({
            type: "scene_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    const flatScenes = flattenScenes(scriptOutline);
    const batchSceneSchema = z.array(z.object({
        scene: sceneContentSchema,
    }));

    try {
        await stream.push({ type: "scene_start", data: { runId } });

        const result = await streamLLMBatch<{ beat_name: string; scene: SceneOutline }, { scene: SceneContent[] }[]>({
            items: flatScenes,
            batchSize,
            buildBatchParams: (batchItems, _batchIndex) => {
                return {
                    systemPrompt: buildSceneDevelopmentSystemPrompt(),
                    userPrompt: getSceneDevelopmentUserPrompt(project, scriptOutline, batchItems),
                    schema: batchSceneSchema,
                    validate: (arr: { scene: SceneContent[] }[]) => {
                        if (arr.length !== batchItems.length) {
                            throw new Error(`Expected ${batchItems.length} scene payloads, got ${arr.length}`);
                        }
                    },
                    stepName: "scene_development",
                    buildDeltaPayload: (scenes: { scene: SceneContent[] }[]) => ({ sceneCount: scenes.length }),
                    streamReasoningDeltas: true,
                };
            },
            stream,
            runId,
            abortController,
            deltaEventType: "scene_delta",
            errorEventType: "scene_error",
            onStart,
            onFinish: async (results, totalUsage) => {
                const generatedScenes = results.flat().map((result) => result.scene);
                await onFinish(generatedScenes, totalUsage);
            },
            onError,
            onAbort,
        });

        if (result.aborted || result.hasError) {
            return;
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await onError(error instanceof Error ? error : new Error(errMsg));
        await stream.push({
            type: "scene_error",
            data: { runId, error: errMsg },
        });
    } finally {
        await stream.push({ type: "scene_end", data: { runId } });
        await stream.close();
    }
}

// ---------------------------------------------------------------------------
// Outline prompts (15-beat sheet)
// ---------------------------------------------------------------------------

function buildOutlineSystemPrompt(): string {
    const jsonSchema = z.toJSONSchema(scriptOutlineSchema);
    return new SystemPromptBuilder()
        .addIdentity(identities.outlineIdentity.default())
        .addSkills(skills.outline.default())
        .addOutputFormat(
            `Output a single JSON object with a "beats" array. Each beat has "beat_name" (one of: ${FIFTEEN_BEATS.join(", ")}) and "scenes". Each scene has: scene_number, slugline, characters_present (array of strings), scene_goal, action_summary. The action_summary must also capture the key conflict or obstacle, the emotional turn, and the consequence or decision that drives the next scene. Do not include markdown or comments.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function getOutlineUserPrompt(project: Project): string {
    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    return `
Generate the script outline using the 15 Beat Sheet structure. Return one JSON object with a "beats" array.

Use these beat names where appropriate: ${FIFTEEN_BEATS.join(", ")}.

BE CONCISE AND TO THE POINT.

Each beat has:
- beat_name: string
- scenes: array of scene cards, each with:
  - scene_number: number (sequential)
  - slugline: "INT./EXT. LOCATION - DAY/NIGHT/etc."
  - characters_present: array of character names
  - scene_goal: what the POV character wants entering the scene
  - action_summary: 2–3 sentence summary of what happens (physically and verbally); also include the key conflict or obstacle, the emotional turn, and the new information, decision, or consequence that forces the next scene

<project_brief>
${JSON.stringify(project.brief)}
</project_brief>

<narrative_arc>
${JSON.stringify(selectedArc)}
</narrative_arc>

<synopsis>
${JSON.stringify(project.synopsis)}
</synopsis>

<story_bible>
${JSON.stringify(project.story_bible)}
</story_bible>
`;
}

// ---------------------------------------------------------------------------
// Scene development prompts
// ---------------------------------------------------------------------------

function buildSceneDevelopmentSystemPrompt(): string {
    const jsonSchema = z.toJSONSchema(z.array(z.object({ scene: sceneContentSchema })));
    return new SystemPromptBuilder()
        .addIdentity(identities.sceneWriterIdentity.default())
        .addSkills([skills.sceneWriting.default(), skills.proseFormat()])
        .addOutputFormat(
            `Output a JSON array of exactly 1–3 items (one per scene in this batch). Each item must be an object with a single "scene" array that represents exactly one scene only.

Hard constraints for each "scene" array:
- Include exactly 1 slugline block, and it must be the first block.
- Never include a second slugline. If the action would move to another time or location, that belongs in a different scene object, not inside the current one.
- Include 0 or 1 transition blocks total.
- A transition is optional, and if used it must be the final block in the array.
- Do not default to "CUT TO:". Only use a transition when it adds real storytelling value, such as "MATCH CUT TO:", "SMASH CUT TO:", or "DISSOLVE TO:".
- If no meaningful transition is needed, omit the transition block entirely.

The "scene" array contains screenplay blocks in chronological order using only these shapes: {"type":"slugline","text":"INT. LOCATION - DAY","locationId":"optional"}, {"type":"action","text":"..."}, {"type":"dialogue","character":"NAME","parenthetical":"optional","text":"..."}, {"type":"transition","text":"MATCH CUT TO:"}. Return only valid JSON, no markdown.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function getSceneDevelopmentUserPrompt(
    project: Project,
    _outline: ScriptOutline,
    batchItems: { beat_name: string; scene: SceneOutline }[]
): string {
    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    const sceneDescriptions = batchItems
        .map(
            (item) =>
                `Scene ${item.scene.scene_number} (${item.beat_name}): ${item.scene.slugline}
  Goal: ${item.scene.scene_goal}
  Action: ${item.scene.action_summary}
  Characters: ${item.scene.characters_present.join(", ")}`
        )
        .join("\n\n");

    return `
Write full script content for these ${batchItems.length} scene(s). Return a JSON array of exactly ${batchItems.length} objects.

For each object:
- The only key must be "scene".
- The "scene" value must contain exactly one scene, not multiple scenes stitched together.
- Start with exactly one slugline block.
- After that, use action and dialogue blocks to dramatize only that same scene.
- Never add another slugline inside the same scene object.
- Include at most one transition block, and only if it adds clear storytelling value.
- If you include a transition, place it at the very end of the scene.
- Do not mechanically end scenes with "CUT TO:".
- Prefer no transition unless a purposeful edit is warranted, such as:
  - "MATCH CUT TO:" for a visual connection
  - "SMASH CUT TO:" for a sudden contrast
  - "DISSOLVE TO:" for passage of time, memory, or dream logic

Important: if you feel tempted to introduce a new location, new time, or a fresh scene beat with its own slugline, do not put it in the current object. Keep the current object focused on one dramatic unit only.

Scenes to write:
${sceneDescriptions}

<story_bible>
${JSON.stringify(project.story_bible)}
</story_bible>

<narrative_arc>
${JSON.stringify(selectedArc)}
</narrative_arc>

<synopsis>
${JSON.stringify(project.synopsis)}
</synopsis>
`;
}

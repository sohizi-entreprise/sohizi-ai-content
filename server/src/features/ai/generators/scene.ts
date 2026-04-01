import { z } from "zod";
import {
    type EntityObject,
    type Outline,
    type SceneOutline,
    type StoryBible,
    sceneContentSchema,
} from "zSchemas";
import { type SceneContent, type ProseDocument } from "@/type";
import { generateScenesOutline } from "./scenes-outline";
import { BaseGeneratorParams } from "../type";
import {
    streamStructuredOutputBatch,
    type StructuredOutputBatchContext,
    type YieldEventType,
} from "../stream-llm";
import { proseDocumentToPlainText } from "../utils";
import { encode } from '@toon-format/toon'

const SCENE_BATCH_SIZE = 3;
const MAX_SCENE_GENERATION_ITERATIONS = 8;
const MAX_SCENE_RETRIES_PER_SCENE = 3;

const batchSceneSchema = z.array(z.object({
    scene: sceneContentSchema,
}));

type SceneBatchPayload = z.infer<typeof batchSceneSchema>;
type SceneBlocks = z.infer<typeof sceneContentSchema>;

type FlattenedScene = {
    beat_name: string;
    scene: SceneOutline;
};

type GeneratedSceneResult = {
    source: FlattenedScene;
    scene: SceneBlocks;
};

type MalformedScene = {
    source: FlattenedScene;
    reason: string;
};

type SceneGenerationState = {
    outline: Outline | null;
    flattenedScenes: FlattenedScene[];
    failedScenes: MalformedScene[];
    results: Map<number, GeneratedSceneResult>;
    retryCounts: Map<number, number>;
};

type GenerateSceneBatchesStepParams = Pick<
    sceneGeneratorParams,
    "payload" | "abortSignal" | "onUsageUpdate" | "onAbort"
> & {
    items: FlattenedScene[];
    isRetry: boolean;
    onBatchSuccess?: (results: GeneratedSceneResult[]) => void | Promise<void>;
    onMalformedScenes?: (malformedScenes: MalformedScene[]) => void | Promise<void>;
    onBatchError?: (
        error: Error,
        context: StructuredOutputBatchContext<FlattenedScene>
    ) => void | Promise<void>;
    onInternalError?: (error: Error) => void | Promise<void>;
};

type Payload = {
    storyBible: StoryBible;
    synopsis: ProseDocument;
    entities: EntityObject[];
};

type sceneGeneratorParams = BaseGeneratorParams<SceneContent[][], Payload>;


export async function* generateScene(
    params: sceneGeneratorParams
): AsyncGenerator<YieldEventType<unknown>, void, unknown> {
    const { payload, onSuccess, onError, onAbort, abortSignal, onUsageUpdate } = params;
    const state: SceneGenerationState = {
        outline: null,
        flattenedScenes: [],
        failedScenes: [],
        results: new Map<number, GeneratedSceneResult>(),
        retryCounts: new Map<number, number>(),
    };
    let partialSuccessReported = false;

    const reportPartialSuccess = async () => {
        if (partialSuccessReported || state.results.size === 0) {
            return;
        }

        partialSuccessReported = true;
        await onSuccess(getOrderedScenes(state));
    };

    yield {
        event: "TASK_UPDATE",
        type: "start",
        data: { phase: "scene_generation" },
    };

    for (
        let iteration = 0;
        iteration < MAX_SCENE_GENERATION_ITERATIONS;
        iteration++
    ) {
        let finishReason: 'stop' | 'error' | 'abort' = 'stop';
        const previousResultCount = state.results.size;

        if (state.outline == null) {
            let generatedOutline: Outline | null = null;
            yield {
                event: "TASK_UPDATE",
                type: "start",
                data: { phase: "outline_scenes" },
            };

            const sceneOutlineResult = await generateScenesOutline({
                payload,
                abortSignal,
                onUsageUpdate,
                onError,
                onAbort,
                onSuccess: async (outline) => {
                    generatedOutline = outline;
                },
            });

            yield {
                event: "TASK_UPDATE",
                type: "usage",
                data: {
                    phase: "outline_scenes",
                    ...sceneOutlineResult.usage,
                },
            };

            if (sceneOutlineResult.error) {
                finishReason = abortSignal.aborted ? "abort" : "error";
                yield {
                    event: "TASK_UPDATE",
                    type: "alert",
                    alertType: finishReason === "abort" ? "abort" : "error",
                    data: { phase: "outline_scenes", error: sceneOutlineResult.error },
                };
                yield {
                    event: "TASK_UPDATE",
                    type: "end",
                    finishReason,
                    data: { phase: "outline_scenes" },
                };
            } else {
                yield {
                    event: "TASK_UPDATE",
                    type: "success",
                    data: {
                        phase: "outline_scenes",
                        payload: sceneOutlineResult.outline,
                    },
                };
                yield {
                    event: "TASK_UPDATE",
                    type: "end",
                    finishReason: "stop",
                    data: { phase: "outline_scenes" },
                };
            }

            if (finishReason !== "stop" || generatedOutline == null) {
                await reportPartialSuccess();
                yield {
                    event: "TASK_UPDATE",
                    type: "end",
                    finishReason,
                    data: { phase: "scene_generation" },
                };
                return;
            }

            state.outline = generatedOutline;
            state.flattenedScenes = flattenScenes(generatedOutline);

            if (state.flattenedScenes.length === 0) {
                const error = new Error("Scene outline did not produce any scenes");
                await onError(error);
                yield {
                    event: "TASK_UPDATE",
                    type: "alert",
                    alertType: "error",
                    data: { phase: "scene_generation", error: error.message },
                };
                yield {
                    event: "TASK_UPDATE",
                    type: "end",
                    finishReason: "error",
                    data: { phase: "scene_generation" },
                };
                return;
            }
        }

        const scenesToProcess = getScenesToProcess(state);
        if (scenesToProcess.length === 0) {
            break;
        }

        const isRetry = state.failedScenes.length > 0;
        const iterationErrors: Error[] = [];
        state.failedScenes = [];

        for await (const event of generateSceneBatchesStep({
            payload,
            items: scenesToProcess,
            isRetry,
            abortSignal,
            onUsageUpdate,
            onAbort,
            onBatchSuccess: async (results) => {
                mergeSceneResults(state, results);
            },
            onMalformedScenes: async (malformedScenes) => {
                state.failedScenes.push(...malformedScenes);
            },
            onBatchError: async (error, context) => {
                state.failedScenes.push(
                    ...context.batchItems.map((item) => ({
                        source: item,
                        reason: error.message,
                    }))
                );
            },
            onInternalError: async (error) => {
                iterationErrors.push(error);
            },
        })) {
            if (event.type === "end" && event.finishReason && event.finishReason !== "stop") {
                finishReason = event.finishReason;
            }

            yield event;
        }

        state.failedScenes = dedupeMalformedScenes(state.failedScenes);

        if (finishReason === "abort") {
            await reportPartialSuccess();
            yield {
                event: "TASK_UPDATE",
                type: "end",
                finishReason: "abort",
                data: { phase: "scene_generation" },
            };
            return;
        }

        if (isSceneGenerationComplete(state)) {
            break;
        }

        incrementRetryCounts(state.retryCounts, state.failedScenes);
        const exhaustedScenes = getExhaustedRetryScenes(state.retryCounts, state.failedScenes);
        if (exhaustedScenes.length > 0) {
            const error = new Error(buildRetryLimitErrorMessage(exhaustedScenes));
            await reportPartialSuccess();
            await onError(error);
            yield {
                event: "TASK_UPDATE",
                type: "alert",
                alertType: "error",
                data: {
                    phase: "scene_generation",
                    error: error.message,
                    malformedScenes: exhaustedScenes.map((item) => ({
                        sceneNumber: item.source.scene.scene_number,
                        slugline: item.source.scene.slugline,
                        reason: item.reason,
                    })),
                },
            };
            yield {
                event: "TASK_UPDATE",
                type: "end",
                finishReason: "error",
                data: { phase: "scene_generation" },
            };
            return;
        }

        const madeProgress = state.results.size > previousResultCount;
        if (!madeProgress) {
            const error = new Error(buildNoProgressErrorMessage(iteration + 1, state.failedScenes, iterationErrors));
            await reportPartialSuccess();
            await onError(error);
            yield {
                event: "TASK_UPDATE",
                type: "alert",
                alertType: "error",
                data: {
                    phase: "scene_generation",
                    error: error.message,
                    malformedScenes: state.failedScenes.map((item) => ({
                        sceneNumber: item.source.scene.scene_number,
                        slugline: item.source.scene.slugline,
                        reason: item.reason,
                    })),
                },
            };
            yield {
                event: "TASK_UPDATE",
                type: "end",
                finishReason: "error",
                data: { phase: "scene_generation" },
            };
            return;
        }
    }

    if (!isSceneGenerationComplete(state)) {
        const error = new Error(buildMaxIterationErrorMessage(state));
        await reportPartialSuccess();
        await onError(error);
        yield {
            event: "TASK_UPDATE",
            type: "alert",
            alertType: "error",
            data: {
                phase: "scene_generation",
                error: error.message,
                malformedScenes: state.failedScenes.map((item) => ({
                    sceneNumber: item.source.scene.scene_number,
                    slugline: item.source.scene.slugline,
                    reason: item.reason,
                })),
            },
        };
        yield {
            event: "TASK_UPDATE",
            type: "end",
            finishReason: "error",
            data: { phase: "scene_generation" },
        };
        return;
    }

    const finalScenes = getOrderedScenes(state);
    await onSuccess(finalScenes);
    yield {
        event: "TASK_UPDATE",
        type: "success",
        data: {
            phase: "scene_generation",
            payload: finalScenes,
        },
    };

    yield {
        event: "TASK_UPDATE",
        type: "end",
        finishReason: "stop",
        data: { phase: "scene_generation" },
    };
}

function generateSceneBatchesStep({
    payload,
    items,
    isRetry,
    abortSignal,
    onUsageUpdate,
    onAbort,
    onBatchSuccess,
    onMalformedScenes,
    onBatchError,
    onInternalError,
}: GenerateSceneBatchesStepParams) {
    return streamStructuredOutputBatch<
        FlattenedScene,
        SceneBatchPayload,
        GeneratedSceneResult[]
    >({
        items,
        batchSize: SCENE_BATCH_SIZE,
        prompt: {
            system: buildSceneDevelopmentSystemPrompt(),
            user: (context) =>
                isRetry
                    ? getRetrySceneDevelopmentUserPrompt(context, payload)
                    : getSceneDevelopmentUserPrompt(context, payload),
        },
        outputSchema: batchSceneSchema,
        schema: batchSceneSchema,
        transform: async (batch, context) => {
            const result = collectSceneBatchResults(batch, context.batchItems);
            await onMalformedScenes?.(result.malformedScenes);
            return result.validScenes;
        },
        abortSignal,
        eventName: "TASK_UPDATE",
        onBatchSuccess,
        onBatchError,
        stopOnBatchError: false,
        onUsageUpdate,
        onError: async (error) => {
            await onInternalError?.(error);
        },
        onAbort,
        baseEventData: {
            phase: isRetry ? "retry_failed_scenes" : "develop_scenes",
        },
        model: "gpt-5.1",
        reasoningEffort: "low",
    });
}

function getScenesToProcess(state: SceneGenerationState): FlattenedScene[] {
    if (state.failedScenes.length > 0) {
        return state.failedScenes.map((item) => item.source);
    }

    return state.flattenedScenes.filter(
        (item) => !state.results.has(item.scene.scene_number)
    );
}

function mergeSceneResults(
    state: SceneGenerationState,
    results: GeneratedSceneResult[]
) {
    for (const result of results) {
        state.results.set(result.source.scene.scene_number, result);
    }
}

function getOrderedScenes(state: SceneGenerationState): SceneContent[][] {
    return Array.from(state.results.values())
        .sort((a, b) => a.source.scene.scene_number - b.source.scene.scene_number)
        .map((item) => item.scene);
}

function isSceneGenerationComplete(state: SceneGenerationState) {
    return (
        state.flattenedScenes.length > 0 &&
        state.results.size === state.flattenedScenes.length &&
        state.failedScenes.length === 0
    );
}

function flattenScenes(outline: Outline): FlattenedScene[] {
    const result: FlattenedScene[] = [];

    for (const beat of outline.beats) {
        for (const scene of beat.scenes) {
            result.push({ beat_name: beat.beat_name, scene });
        }
    }

    return result;
}

function dedupeMalformedScenes(items: MalformedScene[]) {
    const latestByScene = new Map<number, MalformedScene>();

    for (const item of items) {
        latestByScene.set(item.source.scene.scene_number, item);
    }

    return Array.from(latestByScene.values());
}

function incrementRetryCounts(
    retryCounts: Map<number, number>,
    failedScenes: MalformedScene[]
) {
    for (const item of failedScenes) {
        const sceneNumber = item.source.scene.scene_number;
        retryCounts.set(sceneNumber, (retryCounts.get(sceneNumber) ?? 0) + 1);
    }
}

function getExhaustedRetryScenes(
    retryCounts: Map<number, number>,
    failedScenes: MalformedScene[]
) {
    return failedScenes.filter(
        (item) =>
            (retryCounts.get(item.source.scene.scene_number) ?? 0) >
            MAX_SCENE_RETRIES_PER_SCENE
    );
}

function collectSceneBatchResults(
    batch: SceneBatchPayload,
    batchItems: FlattenedScene[]
): {
    validScenes: GeneratedSceneResult[];
    malformedScenes: MalformedScene[];
} {
    if (batch.length !== batchItems.length) {
        return {
            validScenes: [],
            malformedScenes: batchItems.map((item) => ({
                source: item,
                reason: `Expected ${batchItems.length} scene payloads, got ${batch.length}`,
            })),
        };
    }

    const validScenes: GeneratedSceneResult[] = [];
    const malformedScenes: MalformedScene[] = [];

    for (let index = 0; index < batchItems.length; index++) {
        const source = batchItems[index];
        const generatedScene = batch[index].scene;
        const validationError = validateSceneContent(generatedScene);

        if (validationError) {
            malformedScenes.push({
                source,
                reason: validationError,
            });
            continue;
        }

        validScenes.push({
            source,
            scene: generatedScene,
        });
    }

    return { validScenes, malformedScenes };
}

function validateSceneContent(scene: SceneBlocks): string | null {
    const sluglineCount = scene.filter((block) => block.type === "slugline").length;
    if (sluglineCount !== 1) {
        return `Expected exactly 1 slugline block, got ${sluglineCount}`;
    }

    const transitionCount = scene.filter((block) => block.type === "transition").length;
    if (transitionCount > 1) {
        return `Expected at most 1 transition block, got ${transitionCount}`;
    }

    return null;
}

function buildRetryLimitErrorMessage(malformedScenes: MalformedScene[]) {
    return `Scene generation exceeded the retry limit for: ${formatMalformedScenes(malformedScenes)}`;
}

function buildNoProgressErrorMessage(
    iteration: number,
    malformedScenes: MalformedScene[],
    iterationErrors: Error[]
) {
    const malformedSummary =
        malformedScenes.length > 0
            ? ` Remaining malformed scenes: ${formatMalformedScenes(malformedScenes)}.`
            : "";
    const errorSummary =
        iterationErrors.length > 0
            ? ` Last error: ${iterationErrors[iterationErrors.length - 1].message}.`
            : "";

    return `Scene generation made no progress on iteration ${iteration}.${malformedSummary}${errorSummary}`;
}

function buildMaxIterationErrorMessage(state: SceneGenerationState) {
    const remaining = state.failedScenes.length
        ? formatMalformedScenes(state.failedScenes)
        : "unknown remaining scenes";

    return `Scene generation reached the maximum iteration limit of ${MAX_SCENE_GENERATION_ITERATIONS}. Remaining scenes: ${remaining}`;
}

function formatMalformedScenes(malformedScenes: MalformedScene[]) {
    return malformedScenes
        .map(
            (item) =>
                `#${item.source.scene.scene_number} (${item.source.scene.slugline}): ${item.reason}`
        )
        .join("; ");
}

const buildSceneDevelopmentSystemPrompt =(): string => `
You are writing concise, production-ready screenplay scenes.

Goal:
- Write scenes that feel visual, active, and dramatically purposeful.
- Use dialogue to reveal character, create tension, and move the story forward.
- Write with economy and subtext.

Scene structure:
- Start late and end early.
- Build through escalation, a turn, and an exit with momentum.
- Keep each scene focused on one dramatic unit only.

Hard rules:
- Each scene must contain exactly 1 slugline block.
- The slugline must be the first block.
- Never include a second slugline in the same scene.
- Each scene may contain 0 or 1 transition block only.
- A transition is optional and should be used only when it adds clear storytelling value.
- If used, the transition must be the final block.
- Do not default to "CUT TO:".

Writing rules:
- Action lines describe only what can be seen or heard.
- Use present tense, active voice, and concise paragraphs.
- Dialogue should feel character-specific and often carry subtext.
- Use parentheticals sparingly and only when needed.

Output:
- Return only valid JSON matching the required schema.
- No markdown, no commentary, no extra text.

`

function getSceneDescriptions(batchItems: FlattenedScene[]) {
    return batchItems
        .map(
            (item) =>
                `Scene ${item.scene.scene_number} (${item.beat_name}): ${item.scene.slugline}
Goal: ${item.scene.scene_goal}
Action: ${item.scene.action_summary}
Characters: ${item.scene.characters_present.join(", ")}`
        )
        .join("\n\n");
}

function getSceneDevelopmentUserPrompt(
    context: StructuredOutputBatchContext<FlattenedScene>,
    payload: Payload
) {
    const { batchItems } = context;
    const { storyBible, synopsis, entities } = payload;

    return `
Write full script content for these ${batchItems.length} scene(s). Return a JSON array of exactly ${batchItems.length} objects.

For each object:
- The only key must be "scene".
- The "scene" value must contain exactly one scene, not multiple scenes stitched together.
- Start with exactly one slugline block.
- After that, use action and dialogue blocks to dramatize only that same scene.
- Never add another slugline inside the same scene object.
- Include at most one transition block, and only if it adds clear storytelling value.
- Keep the writing concise, visual, and active.

<story_bible>
${encode(storyBible)}
</story_bible>

<entities>
${encode(entities)}
</entities>

<synopsis>
${proseDocumentToPlainText(synopsis)}
</synopsis>
---
Scenes to write:
${getSceneDescriptions(batchItems)}
`;
}

function getRetrySceneDevelopmentUserPrompt(
    context: StructuredOutputBatchContext<FlattenedScene>,
    payload: Payload
) {
    return `${getSceneDevelopmentUserPrompt(context, payload)}

Important retry note:
- One or more of these scenes was previously malformed.
- For every scene, include exactly 1 slugline block.
- For every scene, include at most 1 transition block.
- Recheck the structure carefully before returning the final JSON.`;
}


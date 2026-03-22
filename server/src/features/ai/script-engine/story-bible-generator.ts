import { Project } from "@/db/schema";
import { SystemPromptBuilder } from "../prompts/promptBuilder";
import { identities } from "../prompts";
import { ResumableStream } from "@/lib";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { CharacterSchema, storyBibleSchema, type StoryBible } from "zSchemas";
import { proseDocumentToPlainText } from "../utils";
import { streamLLMStep, streamLLMBatch } from "./stream-llm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Character = z.infer<typeof CharacterSchema>;

type BaseParams = {
    project: Project;
    stream: ResumableStream;
    onStart?: () => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
};

type StoryBibleOutlineParams = BaseParams & {
    onFinish: (storyBible: StoryBible, totalUsage: number) => void | Promise<void>;
};

type CharacterDevelopmentParams = BaseParams & {
    /** Batch size for character development (default: 3) */
    batchSize?: number;
    onFinish: (characters: Character[], totalUsage: number) => void | Promise<void>;
};

// ---------------------------------------------------------------------------
// Generate Story Bible Outline
// ---------------------------------------------------------------------------

/**
 * Generates the story bible outline (world, conflict engine, key characters/locations, tone, continuity rules).
 * This is an independent step that can be called separately.
 */
export async function generateStoryBibleOutline({
    project,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: StoryBibleOutlineParams) {
    const runId = uuidv4();
    const abortController = new AbortController();

    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    if (!selectedArc) {
        const errorMessage = "You must select a narrative arc before generating a story bible";
        await stream.push({
            type: "story_bible_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    if (!project.synopsis) {
        const errorMessage = "Synopsis is required before generating a story bible";
        await stream.push({
            type: "story_bible_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    try {
        await stream.push({ type: "story_bible_start", data: { runId } });

        const result = await streamLLMStep({
            systemPrompt: buildOutlineSystemPrompt(),
            userPrompt: getOutlineUserPrompt(project),
            schema: storyBibleSchema,
            stream,
            runId,
            abortSignal: abortController.signal,
            deltaEventType: "story_bible_delta",
            errorEventType: "story_bible_error",
            stepName: "outline",
            onStart,
            onFinish,
            onError: async(err) => {
                console.log('story bible error', err);
                await stream.push({
                    type: "story_bible_error",
                    data: { runId, error: err.message },
                });
                await onError(err);
            },
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
                type: "story_bible_error",
                data: { runId, error: result.error },
            });
            await stream.close();
            return;
        }

        if (!result.result) {
            await onError(new Error("Story bible outline did not produce valid output"));
            await stream.push({
                type: "story_bible_error",
                data: { runId, error: "Story bible outline did not produce valid output" },
            });
            await stream.close();
            return;
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await onError(error instanceof Error ? error : new Error(errMsg));
        await stream.push({
            type: "story_bible_error",
            data: { runId, error: errMsg },
        });
    } finally {
        await stream.push({ type: "story_bible_end", data: { runId } });
        await stream.close();
    }
}

// ---------------------------------------------------------------------------
// Generate Character Development
// ---------------------------------------------------------------------------

/**
 * Develops characters in depth based on keyCharacters from a story bible.
 * Processes characters in batches for efficiency.
 * This is an independent step that can be called separately.
 */
export async function generateCharacterDevelopment({
    project,
    batchSize = 3,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: CharacterDevelopmentParams) {
    const runId = uuidv4();
    const abortController = new AbortController();

    const storyBible = project.story_bible;

    if (!project.synopsis || !storyBible) {
        const errorMessage = "Synopsis and story bible are required before generating characters";
        await stream.push({
            type: "character_error",
            data: { runId, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    const characterSchema = z.array(CharacterSchema);

    try {
        await stream.push({ type: "character_start", data: { runId } });

        const result = await streamLLMBatch<{ name: string }, Character[]>({
            items: storyBible.keyCharacters,
            batchSize,
            buildBatchParams: (batchItems, _batchIndex) => {
                const characterNames = batchItems.map((c) => c.name);
                return {
                    systemPrompt: buildCharacterDevelopmentSystemPrompt(),
                    userPrompt: getCharacterDevelopmentUserPrompt(project, storyBible, characterNames),
                    schema: characterSchema,
                    validate: (arr: Character[]) => {
                        if (arr.length === 0 || arr.length > batchSize) {
                            throw new Error(`Expected 1–${batchSize} characters, got ${arr.length}`);
                        }
                    },
                    stepName: "character_development",
                    buildDeltaPayload: (characters: Character[]) => ({ characters }),
                    streamReasoningDeltas: true,
                };
            },
            stream,
            runId,
            abortController,
            deltaEventType: "character_delta",
            errorEventType: "character_error",
            onStart,
            onFinish: async (results, totalUsage) => {
                const allCharacters = results.flat();
                await onFinish(allCharacters, totalUsage);
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
            type: "character_error",
            data: { runId, error: errMsg },
        });
    } finally {
        await stream.push({ type: "character_end", data: { runId } });
        await stream.close();
    }
}

// ---------------------------------------------------------------------------
// Outline prompts
// ---------------------------------------------------------------------------

function buildOutlineSystemPrompt(): string {
    const jsonSchema = z.toJSONSchema(storyBibleSchema);
    return new SystemPromptBuilder()
        .addIdentity(identities.worldBuilderIdentity.default())
        .addOutputFormat(
            `Output a single JSON object matching this schema. Do not include markdown or comments.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function getOutlineUserPrompt(project: Project): string {
    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    return `
Generate the story bible metadata for this project. Return one JSON object only.
Follow the project brief, narrative arc, and synopsis to generate that story bible.

<project_brief>
${JSON.stringify(project.brief)}
</project_brief>

<narrative_arc>
${JSON.stringify(selectedArc)}
</narrative_arc>

<synopsis>
${proseDocumentToPlainText(project.synopsis)}
</synopsis>
`;
}

// ---------------------------------------------------------------------------
// Character development prompts
// ---------------------------------------------------------------------------

function buildCharacterDevelopmentSystemPrompt(): string {
    const arrSchema = z.array(CharacterSchema).min(1).max(3);
    const jsonSchema = z.toJSONSchema(arrSchema);
    return new SystemPromptBuilder()
        .addIdentity(identities.characterIdentity.default())
        .addOutputFormat(
            `Output a JSON array of 1–3 character objects. No markdown or comments.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function getCharacterDevelopmentUserPrompt(
    project: Project,
    storyBible: StoryBible,
    characterNames: string[]
): string {
    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    return `
Develop these characters in depth: ${characterNames.join(", ")}.

Return a JSON array of exactly ${characterNames.length} character objects matching the expected character schema.

Story context:
- World: ${storyBible.world.setting}, ${storyBible.world.timePeriod}
- Conflict: ${storyBible.conflictEngine.centralConflict}
- Tone: ${storyBible.toneAndStyle.visualStyle}, ${storyBible.toneAndStyle.dialogueStyle}

<narrative_arc>
${JSON.stringify(selectedArc)}
</narrative_arc>

<synopsis>
${proseDocumentToPlainText(project.synopsis)}
</synopsis>

<story_bible>
${JSON.stringify(storyBible)}
</story_bible>
`;
}

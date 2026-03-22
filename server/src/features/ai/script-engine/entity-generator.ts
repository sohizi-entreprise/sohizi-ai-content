import { Project } from "@/db/schema";
import { SystemPromptBuilder } from "../prompts/promptBuilder";
import { identities } from "../prompts";
import { ResumableStream } from "@/lib";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
    CharacterSchema,
    LocationSchema,
    PropSchema,
    type Character,
    type Location,
    type Prop,
} from "zSchemas";
import { proseDocumentToPlainText } from "../utils";
import { streamLLMStep } from "./stream-llm";

type BaseParams = {
    project: Project;
    stream: ResumableStream;
    onStart?: () => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
};

type EntityKind = "character" | "location" | "prop";

type RegenerateCharacterParams = BaseParams & {
    currentCharacter: Character;
    onFinish: (character: Character, totalUsage: number) => void | Promise<void>;
};

type RegenerateLocationParams = BaseParams & {
    currentLocation: Location;
    onFinish: (location: Location, totalUsage: number) => void | Promise<void>;
};

type RegeneratePropParams = BaseParams & {
    currentProp: Prop;
    onFinish: (prop: Prop, totalUsage: number) => void | Promise<void>;
};

type RegenerateEntityParams<T> = BaseParams & {
    entityType: EntityKind;
    schema: z.ZodSchema<T>;
    systemPrompt: string;
    userPrompt: string;
    onFinish: (entity: T, totalUsage: number) => void | Promise<void>;
};

async function regenerateEntity<T>({
    project,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
    entityType,
    schema,
    systemPrompt,
    userPrompt,
}: RegenerateEntityParams<T>) {
    const runId = uuidv4();
    const abortController = new AbortController();

    if (!project.synopsis || !project.story_bible) {
        const errorMessage = "Synopsis and story bible are required before regenerating an entity";
        await stream.push({
            type: "entity_error",
            data: { runId, entityType, error: errorMessage },
        });
        await stream.close();
        await onError(new Error(errorMessage));
        return;
    }

    try {
        await stream.push({ type: "entity_start", data: { runId, entityType } });

        const result = await streamLLMStep({
            systemPrompt,
            userPrompt,
            schema,
            stream,
            runId,
            abortSignal: abortController.signal,
            deltaEventType: "entity_delta",
            errorEventType: "entity_error",
            stepName: `${entityType}_regeneration`,
            onStart,
            onFinish,
            onError: async (err) => {
                await stream.push({
                    type: "entity_error",
                    data: { runId, entityType, error: err.message },
                });
                await onError(err);
            },
            onAbort,
            baseEventData: { entityType },
            buildDeltaPayload: (entity) => ({
                entityType,
                payload: entity,
            }),
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
                type: "entity_error",
                data: { runId, entityType, error: result.error },
            });
            await stream.close();
            return;
        }

        if (!result.result) {
            const errorMessage = `Entity regeneration did not produce valid ${entityType} output`;
            await onError(new Error(errorMessage));
            await stream.push({
                type: "entity_error",
                data: { runId, entityType, error: errorMessage },
            });
            await stream.close();
            return;
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await onError(error instanceof Error ? error : new Error(errMsg));
        await stream.push({
            type: "entity_error",
            data: { runId, entityType, error: errMsg },
        });
    } finally {
        await stream.push({ type: "entity_end", data: { runId, entityType } });
        await stream.close();
    }
}

export async function regenerateCharacter({
    project,
    currentCharacter,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: RegenerateCharacterParams) {
    await regenerateEntity({
        project,
        stream,
        onStart,
        onFinish,
        onError,
        onAbort,
        entityType: "character",
        schema: CharacterSchema,
        systemPrompt: buildCharacterSystemPrompt(),
        userPrompt: getCharacterUserPrompt(project, currentCharacter),
    });
}

export async function regenerateLocation({
    project,
    currentLocation,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: RegenerateLocationParams) {
    await regenerateEntity({
        project,
        stream,
        onStart,
        onFinish,
        onError,
        onAbort,
        entityType: "location",
        schema: LocationSchema,
        systemPrompt: buildLocationSystemPrompt(),
        userPrompt: getLocationUserPrompt(project, currentLocation),
    });
}

export async function regenerateProp({
    project,
    currentProp,
    stream,
    onStart,
    onFinish,
    onError,
    onAbort,
}: RegeneratePropParams) {
    await regenerateEntity({
        project,
        stream,
        onStart,
        onFinish,
        onError,
        onAbort,
        entityType: "prop",
        schema: PropSchema,
        systemPrompt: buildPropSystemPrompt(),
        userPrompt: getPropUserPrompt(project, currentProp),
    });
}

function buildCharacterSystemPrompt(): string {
    const jsonSchema = z.toJSONSchema(CharacterSchema);
    return new SystemPromptBuilder()
        .addIdentity(identities.characterIdentity.default())
        .addOutputFormat(
            `Output a single JSON object matching this schema. Preserve story continuity and do not include markdown or comments.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function buildLocationSystemPrompt(): string {
    const jsonSchema = z.toJSONSchema(LocationSchema);
    return new SystemPromptBuilder()
        .addIdentity(identities.worldBuilderIdentity.default())
        .addOutputFormat(
            `Output a single JSON object matching this schema. Preserve story continuity and do not include markdown or comments.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function buildPropSystemPrompt(): string {
    const jsonSchema = z.toJSONSchema(PropSchema);
    return new SystemPromptBuilder()
        .addIdentity(identities.worldBuilderIdentity.default())
        .addOutputFormat(
            `Output a single JSON object matching this schema. Preserve story continuity and do not include markdown or comments.\n${JSON.stringify(jsonSchema)}`
        )
        .build();
}

function getSharedEntityContext(project: Project): string {
    const selectedArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    return `
<project_brief>
${JSON.stringify(project.brief)}
</project_brief>

<narrative_arc>
${JSON.stringify(selectedArc)}
</narrative_arc>

<synopsis>
${project.synopsis ? proseDocumentToPlainText(project.synopsis) : ""}
</synopsis>

<story_bible>
${JSON.stringify(project.story_bible)}
</story_bible>
`;
}

function getCharacterUserPrompt(project: Project, currentCharacter: Character): string {
    return `
Regenerate this character so it is richer, more specific, and more useful for future script writing while staying fully consistent with the current project canon.

Return exactly one character object that matches the expected schema.

<current_character>
${JSON.stringify(currentCharacter)}
</current_character>

${getSharedEntityContext(project)}
`;
}

function getLocationUserPrompt(project: Project, currentLocation: Location): string {
    return `
Regenerate this location so it is more vivid, specific, and production-useful while staying fully consistent with the current project canon.

Return exactly one location object that matches the expected schema.

<current_location>
${JSON.stringify(currentLocation)}
</current_location>

${getSharedEntityContext(project)}
`;
}

function getPropUserPrompt(project: Project, currentProp: Prop): string {
    return `
Regenerate this prop so it is more distinctive, meaningful, and story-relevant while staying fully consistent with the current project canon.

Return exactly one prop object that matches the expected schema.

<current_prop>
${JSON.stringify(currentProp)}
</current_prop>

${getSharedEntityContext(project)}
`;
}
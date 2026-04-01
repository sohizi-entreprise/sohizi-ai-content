import { Output, generateText } from "ai";
import { StoryBible } from "zSchemas";
import { z } from "zod";
import { ProseDocument } from "@/type";
import { openai } from "@/lib/llm-providers";
import { BaseGeneratorParams, type OnUsageUpdateParams } from "../type";
import { proseDocumentToPlainText } from "../utils";
import { encode } from "@toon-format/toon";

export const entityOutlineSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("character"),
        name: z.string().min(1),
        role: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
        description: z.string().min(1),
    }),
    z.object({
        type: z.literal("location"),
        name: z.string().min(1),
        description: z.string().min(1),
    }),
    z.object({
        type: z.literal("prop"),
        name: z.string().min(1),
        description: z.string().min(1),
    }),
]);

export const entityOutlineListSchema = z.array(entityOutlineSchema);

type Payload = {
    storyBible: StoryBible;
    synopsis: ProseDocument;
};

export type EntityOutline = z.infer<typeof entityOutlineSchema>;
type CharacterEntityOutline = Extract<EntityOutline, { type: "character" }>;
type LocationEntityOutline = Extract<EntityOutline, { type: "location" }>;
type PropEntityOutline = Extract<EntityOutline, { type: "prop" }>;

export type ExtractedEntities = {
    characters: Omit<CharacterEntityOutline, "type">[];
    locations: Omit<LocationEntityOutline, "type">[];
    props: Omit<PropEntityOutline, "type">[];
};

type GenerateEntityOutlineParams = BaseGeneratorParams<EntityOutline[], Payload>;

export type GenerateEntityOutlineResult = {
    entities: EntityOutline[];
    usage: OnUsageUpdateParams;
    error?: string;
};

const ENTITY_OUTLINE_MODEL = "gpt-5.1";

export async function generateEntityOutline(
    params: GenerateEntityOutlineParams
): Promise<GenerateEntityOutlineResult> {
    const {
        payload,
        abortSignal,
        onAbort,
        onError,
        onSuccess,
        onUsageUpdate,
    } = params;
    const { storyBible, synopsis } = payload;
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
            model: openai(ENTITY_OUTLINE_MODEL),
            output: Output.array({ element: entityOutlineSchema }),
            system: getEntityExtractionSystemPrompt(),
            prompt: getEntityExtractionUserPrompt(storyBible, synopsis),
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

        const parsed = entityOutlineListSchema.parse(JSON.parse(result.text));
        const entities = normalizeEntityOutlines(parsed);
        await onSuccess(entities);
        return {
            entities,
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

export function groupEntityOutlines(entityOutlines: EntityOutline[]): ExtractedEntities {
    return {
        characters: entityOutlines
            .filter((entity): entity is CharacterEntityOutline => entity.type === "character")
            .map(({ type: _type, ...entity }) => entity),
        locations: entityOutlines
            .filter((entity): entity is LocationEntityOutline => entity.type === "location")
            .map(({ type: _type, ...entity }) => entity),
        props: entityOutlines
            .filter((entity): entity is PropEntityOutline => entity.type === "prop")
            .map(({ type: _type, ...entity }) => entity),
    };
}

function normalizeEntityOutlines(entities: EntityOutline[]): EntityOutline[] {
    const seen = new Set<string>();

    return entities
        .map((entity) => ({
            ...entity,
            name: entity.name.trim(),
            description: entity.description.trim(),
        }))
        .filter((entity) => {
            const normalizedKey = `${entity.type}:${entity.name.toLowerCase()}`;
            if (!entity.name || !entity.description || seen.has(normalizedKey)) {
                return false;
            }

            seen.add(normalizedKey);
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
        model: ENTITY_OUTLINE_MODEL,
    };
}

const getEntityExtractionSystemPrompt = () => `
You are a story development assistant extracting the key entities needed for script development.

Goal:
- Identify only the most story-relevant characters, locations, and props from the provided material.
- Return them as a single flat list of entities to develop further.
- Keep every description concise and straight to the point.

Rules:
- Return only entities that materially affect the story.
- Avoid duplicates, aliases, and minor background details.
- Do not invent entities that are not supported by the synopsis or story bible.
- Prefer specificity over verbosity.

Output requirements:
- Return one JSON array.
- Every entity must include a type field.
- character: type, name, role, description
- location: type, name, description
- prop: type, name, description

Field guidance:
- Character description: explain who the character is and why they matter in the script.
- Location description: explain what the place is and why it matters.
- Prop description: explain what the prop is and its narrative function.

Style:
- Keep each description to 1-2 tight sentences.
- Avoid filler, repetition, and poetic language.
- Return only valid structured output matching the schema.
`;

const getEntityExtractionUserPrompt = (storyBible: StoryBible, synopsis: ProseDocument) => `
Extract the key entities for this story.

Important:
- Include only essential characters, locations, and props.
- Return a flat list of entities, not grouped buckets.
- Keep the wording concise and concrete.
- Do not add any text outside the structured result.

<story_bible>
${encode(storyBible)}
</story_bible>

<synopsis>
${proseDocumentToPlainText(synopsis)}
</synopsis>
`;
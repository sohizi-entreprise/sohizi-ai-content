import {
    CharacterSchema,
    LocationSchema,
    PropSchema,
    StoryBible,
    type Character,
    type Location,
    type Prop,
} from "zSchemas";
import { z } from "zod";
import {
    generateEntityOutline,
    groupEntityOutlines,
    type ExtractedEntities,
} from "./entity-outline";
import { BaseGeneratorParams } from "../type";
import {
    streamStructuredOutputBatch,
    type YieldEventType,
} from "../stream-llm";
import { ProseDocument } from "@/type";
import { proseDocumentToPlainText } from "../utils";
import { encode } from '@toon-format/toon'

const CHARACTER_BATCH_SIZE = 3;

const groupedEntitiesSchema = z.object({
    characters: z.array(CharacterSchema),
    locations: z.array(LocationSchema),
    props: z.array(PropSchema),
});

type Payload = {
    storyBible: StoryBible;
    synopsis: ProseDocument;
};

type ExtractedCharacter = {
    name: string;
    role: "protagonist" | "antagonist" | "supporting" | "minor";
    description: string;
};
type GroupedEntities = z.infer<typeof groupedEntitiesSchema>;
type entityGeneratorParams = BaseGeneratorParams<GroupedEntities, Payload>;

export async function* generateEntity(
    params: entityGeneratorParams
): AsyncGenerator<YieldEventType<unknown>, void, unknown> {
    const { payload, onSuccess, onError, onAbort, abortSignal, onUsageUpdate } = params;
    const { storyBible, synopsis } = payload;
    let finishReason: 'stop' | 'error' | 'abort' = 'stop';
    let entityOutline: ExtractedEntities | null = null;
    let developedCharacterBatches: Character[][] = [];

    yield {
        event: "TASK_UPDATE",
        type: "start",
        data: { phase: "entity_generation" },
    };

    yield {
        event: "TASK_UPDATE",
        type: "start",
        data: { phase: "extract_entities" },
    };

    const entityOutlineResult = await generateEntityOutline({
        payload,
        onSuccess: async (result) => {
            entityOutline = groupEntityOutlines(result);
        },
        onError,
        onAbort,
        onUsageUpdate,
        abortSignal,
    });

    yield {
        event: "TASK_UPDATE",
        type: "usage",
        data: {
            phase: "extract_entities",
            ...entityOutlineResult.usage,
        },
    };

    if (entityOutlineResult.error) {
        finishReason = abortSignal.aborted ? "abort" : "error";
        yield {
            event: "TASK_UPDATE",
            type: "alert",
            alertType: finishReason === "abort" ? "abort" : "error",
            data: { phase: "extract_entities", error: entityOutlineResult.error },
        };

        yield {
            event: "TASK_UPDATE",
            type: "end",
            finishReason,
            data: { phase: "extract_entities" },
        };
    } else {
        yield {
            event: "TASK_UPDATE",
            type: "success",
            data: {
                phase: "extract_entities",
                payload: entityOutlineResult.entities,
            },
        };
        yield {
            event: "TASK_UPDATE",
            type: "end",
            finishReason: "stop",
            data: { phase: "extract_entities" },
        };
    }

    if (finishReason !== "stop" || entityOutline == null) {
        yield {
            event: "TASK_UPDATE",
            type: "end",
            finishReason,
            data: { phase: "entity_generation" },
        };
        return;
    }

    const entitySeeds = entityOutline as ExtractedEntities;

    for await (const event of streamStructuredOutputBatch<
        ExtractedCharacter,
        Character[],
        Character[]
    >({
        items: entitySeeds.characters,
        batchSize: CHARACTER_BATCH_SIZE,
        prompt: {
            system: getCharacterEnrichmentSystemPrompt(),
            user: ({ batchItems }) =>
                getCharacterEnrichmentUserPrompt(batchItems, storyBible, synopsis),
        },
        outputSchema: z.array(CharacterSchema),
        schema: z.array(CharacterSchema),
        abortSignal,
        eventName: "TASK_UPDATE",
        onSuccess: async (results) => {
            developedCharacterBatches = results;
        },
        onUsageUpdate,
        onError,
        onAbort,
        baseEventData: { phase: "develop_characters" },
        model: "gpt-5.1",
        reasoningEffort: "low",
    })) {
        if (event.type === "end" && event.finishReason && event.finishReason !== "stop") {
            finishReason = event.finishReason;
        }

        yield event;
    }

    if (finishReason !== "stop") {
        yield {
            event: "TASK_UPDATE",
            type: "end",
            finishReason,
            data: { phase: "entity_generation" },
        };
        return;
    }

    const characters = developedCharacterBatches.flat();
    const finalEntities = groupedEntitiesSchema.parse({
        characters,
        locations: entitySeeds.locations,
        props: entitySeeds.props,
    }) as {
        characters: Character[];
        locations: Location[];
        props: Prop[];
    };

    await onSuccess(finalEntities);
    yield {
        event: "TASK_UPDATE",
        type: "success",
        data: {
            phase: "entity_generation",
            payload: finalEntities,
        },
    };

    yield {
        event: "TASK_UPDATE",
        type: "end",
        finishReason: "stop",
        data: { phase: "entity_generation" },
    };
}

const getCharacterEnrichmentSystemPrompt = () => `
You are a character development assistant expanding concise character summaries into full writer-ready character profiles.

Goal:
- Turn the provided batch of characters into complete character objects that match the schema.
- Stay fully consistent with the synopsis and story bible.
- Keep each field concise, concrete, and useful for writing.

Rules:
- Only develop the characters provided in the batch.
- Do not add extra characters.
- Preserve each character's narrative role and story function.
- Infer missing details only when necessary, using the most plausible option.
- Avoid melodrama, filler, and generic phrasing.

Field guidance:
- age, occupation, motivation, flaw, and backstory should be specific but compact.
- physicalDescription should be brief and visual.
- personalityTraits should be a short list of distinct traits.
- voice should describe how the character speaks in 1-2 concise sentences, not a long monologue.

Output rules:
- Return one JSON array matching the schema.
- Keep every field straight to the point.
- No commentary or markdown.
`;

const getCharacterEnrichmentUserPrompt = (
    characters: ExtractedCharacter[],
    storyBible: StoryBible,
    synopsis: ProseDocument
) => `
Develop the following characters into full character profiles.

Important:
- Keep the output concise and story-relevant.
- Stay faithful to the synopsis and story bible.
- Return only the characters provided in this batch.

<character_batch>
${encode(characters)}
</character_batch>

<story_bible>
${encode(storyBible)}
</story_bible>

<synopsis>
${proseDocumentToPlainText(synopsis)}
</synopsis>
`;
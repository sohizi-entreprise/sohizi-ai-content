import { z } from "zod";
import { EntityObject } from "zSchemas";
import { generationRequestSchema } from "./schema";
import { projectRepo } from "@/entities/project";
import { Entity, Project } from "@/db/schema";

type GenerationRequestPayload = z.infer<typeof generationRequestSchema>;
type GenerationRequestKind = GenerationRequestPayload["type"];
type RequestByType<T extends GenerationRequestKind> = Extract<
    GenerationRequestPayload,
    { type: T }
>;
type TypedEntityObject = EntityObject & { type: Entity["type"] };

export type PayloadByType = {
    GENERATE_CONCEPT: {
        brief: NonNullable<Project["brief"]>;
    };
    GENERATE_SYNOPSIS: {
        brief: NonNullable<Project["brief"]>;
        narrativeArc: NonNullable<Project["narrative_arcs"]>[number];
    };
    GENERATE_STORY_BIBLE: {
        synopsis: NonNullable<Project["synopsis"]>;
    };
    GENERATE_ENTITY: {
        storyBible: NonNullable<Project["story_bible"]>;
        synopsis: NonNullable<Project["synopsis"]>;
    };
    GENERATE_SCENE: {
        storyBible: NonNullable<Project["story_bible"]>;
        synopsis: NonNullable<Project["synopsis"]>;
        entities: TypedEntityObject[];
    };
    CHAT_COMPLETION: {
        prompt: string;
    };
};

type PayloadAdapterMap = {
    [K in GenerationRequestKind]: (
        project: Project,
        request: RequestByType<K>
    ) => Promise<PayloadByType[K]> | PayloadByType[K];
};

const payloadAdapterMap = {
    GENERATE_CONCEPT: (project) => {
        return { brief: requireBrief(project) };
    },
    GENERATE_SYNOPSIS: (project) => {
        return {
            brief: requireBrief(project),
            narrativeArc: requireSelectedNarrativeArc(project),
        };
    },
    GENERATE_STORY_BIBLE: (project) => {
        return { synopsis: requireSynopsis(project) };
    },
    GENERATE_ENTITY: (project) => {
        return {
            storyBible: requireStoryBible(project),
            synopsis: requireSynopsis(project),
        };
    },
    GENERATE_SCENE: async (project) => {
        const entities = await projectRepo.listEntities(project.id, undefined, 100);
        if (entities.items.length === 0) {
            throw new Error("Entities are required for scene generation");
        }

        const transformedEntities: TypedEntityObject[] = entities.items.map((entity) => ({
            type: entity.type,
            ...(entity.metadata as EntityObject),
        }));
        transformedEntities.sort((a, b) => a.type.localeCompare(b.type));

        return {
            storyBible: requireStoryBible(project),
            synopsis: requireSynopsis(project),
            entities: transformedEntities,
        };
    },
    CHAT_COMPLETION: (_project, request) => {
        return { prompt: request.data.prompt };
    },
} satisfies PayloadAdapterMap;

export async function payloadAdapter<T extends GenerationRequestKind>(
    request: RequestByType<T>,
    project: Project
): Promise<PayloadByType[T]> {
    const handler = payloadAdapterMap[request.type] as PayloadAdapterMap[T];
    return await handler(project, request);
}

function requireBrief(project: Project): NonNullable<Project["brief"]> {
    if (!project.brief) {
        throw new Error("Project brief is required");
    }

    return project.brief;
};

function requireSynopsis(project: Project): NonNullable<Project["synopsis"]> {
    if (!project.synopsis) {
        throw new Error("Synopsis is required");
    }

    return project.synopsis;
};

function requireStoryBible(project: Project): NonNullable<Project["story_bible"]> {
    if (!project.story_bible) {
        throw new Error("Story bible is required");
    }

    return project.story_bible;
};

function requireSelectedNarrativeArc(
    project: Project
): NonNullable<Project["narrative_arcs"]>[number]{
    const selectedNarrativeArc = project.narrative_arcs?.find((arc) => arc.isSelected);
    if (!selectedNarrativeArc) {
        throw new Error("No selected narrative arc found");
    }

    return selectedNarrativeArc;
};
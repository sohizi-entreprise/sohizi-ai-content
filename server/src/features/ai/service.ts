import { projectRepo } from "@/entities/project";
import { NotFound, BadRequest, Forbidden } from "../error";
import { ResumableStream, redis } from "@/lib";
import { conceptGenerator } from "./script-engine/concept-generator";
import { NarrativeArcList, StoryBible, CharacterSchema, Location, EntityObject, Prop, Character } from "zSchemas";
import { Entity, Project } from "@/db/schema";
import { synopsisGenerator } from "./script-engine/synopsis-generator";
import { generateStoryBibleOutline, generateCharacterDevelopment } from "./script-engine/story-bible-generator";
import { generateScriptOutline, generateScenes, type ScriptOutline } from "./script-engine/script-generator";
import { z } from "zod";
import type { ProseDocument } from "@/type";
import { regenerateCharacter, regenerateLocation, regenerateProp } from "./script-engine/entity-generator";


export const supportedScriptComponentTypes = ['concept', 'synopsis', 'outline', 'script', 'world_bible_outline', 'world_bible', 'characters', 'scenes'] as const;
export type ScriptComponentType = (typeof supportedScriptComponentTypes)[number];

export const generateScriptComponents = async (projectId: string, componentType: ScriptComponentType, _prompt?: string) => {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }

    if (!supportedScriptComponentTypes.includes(componentType)) {
        throw new BadRequest('Invalid script component type');
    }

    const stream = new ResumableStream(redis, projectId);

    // Fire and forget - run the job in the background
    switch (componentType) {
        case 'concept':
            if (!project.brief) {
                throw new Forbidden('Project brief is required to generate concepts');
            }
            generateConcepts(project, stream);
            break;
        case 'synopsis':
            if (!project.narrative_arcs?.find(arc => arc.isSelected)) {
                throw new Forbidden('You must select a narrative arc before generating a synopsis');
            }
            generateSynopsis(project, stream);
            break;

        case 'world_bible_outline':
            generateStoryBible(projectId, stream);
            break;

        case 'world_bible': {
            void (
                async () => {
                    await generateStoryBible(projectId, stream);
                    await generateCharacters(projectId, stream);
                }
            )()
            break;
        }
        case 'script':{
            void (
                async () => {
                    await generateScriptOutlineService(projectId, stream);
                    await generateScriptScenes(projectId, stream);
                }
            )()
            break;
        }
        case 'outline':
            generateScriptOutlineService(projectId, stream);
            break;
        case 'characters':
            generateCharacters(projectId, stream);
            break;
        case 'scenes':
            generateScriptScenes(projectId, stream);
            break;
        default:
            break;
    }

    return {ok: true, projectId}
}


export const generateConcepts = async (project: Project, stream: ResumableStream) => {
    const projectId = project.id;

    const onStart = async() => {
        await projectRepo.updateProject(projectId, { status: 'CONCEPT_GENERATION_IN_PROGRESS' });

    }

    const onFinish = async(narrativeArcs: NarrativeArcList, totalUsage: number) => {
        await projectRepo.updateProject(projectId, { status: 'CONCEPT_GENERATION_COMPLETED', narrative_arcs: narrativeArcs });
    }

    const onError = async(error: Error) => {
        // TODO save the error to the database
        await projectRepo.updateProject(projectId, { status: 'CONCEPT_GENERATION_FAILED'});
    }

    const onAbort = async() => {
        await projectRepo.updateProject(projectId, { status: 'CONCEPT_GENERATION_ABORTED'});
    }

    await conceptGenerator({ project, onStart, onFinish, onError, onAbort, stream });

} 

export const generateSynopsis = async (project: Project, stream: ResumableStream) => {
    const projectId = project.id;

    const onStart = async() => {
        await projectRepo.updateProject(projectId, { status: 'SYNOPSIS_GENERATION_IN_PROGRESS' });
    }

    const onFinish = async(synopsis: Record<string, unknown>, totalUsage: number) => {
        await projectRepo.updateProject(projectId, { status: 'SYNOPSIS_GENERATION_COMPLETED', synopsis: synopsis });
    }

    const onError = async(error: Error) => {
        // TODO save the error to the database
        await projectRepo.updateProject(projectId, { status: 'SYNOPSIS_GENERATION_FAILED'});
    }
    
    const onAbort = async() => {
        await projectRepo.updateProject(projectId, { status: 'SYNOPSIS_GENERATION_ABORTED'});
    }

    await synopsisGenerator({ project, onStart, onFinish, onError, onAbort, stream });

} 

// ---------------------------------------------------------------------------
// Story Bible Services
// ---------------------------------------------------------------------------

export const generateStoryBible = async (projectId: string, stream: ResumableStream) => {
    const project = await projectRepo.getProjectById(projectId);

    const onStart = async () => {
        await projectRepo.updateProject(projectId, { status: 'WORLD_BIBLE_GENERATION_IN_PROGRESS' });
    };

    const onFinish = async (storyBible: StoryBible, _totalUsage: number) => {
        // Note: StoryBible schema from zSchemas differs from the DB schema.
        // The generator output is stored as-is; schema alignment may be needed.
        await projectRepo.updateProject(projectId, {
            status: 'WORLD_BIBLE_GENERATION_COMPLETED',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            story_bible: storyBible as any,
        });
    };

    const onError = async (_error: Error) => {
        await projectRepo.updateProject(projectId, { status: 'WORLD_BIBLE_GENERATION_FAILED' });
    };

    const onAbort = async () => {
        await projectRepo.updateProject(projectId, { status: 'WORLD_BIBLE_GENERATION_FAILED' });
    };

    await generateStoryBibleOutline({ project, stream, onStart, onFinish, onError, onAbort });
};

export const generateCharacters = async (projectId: string, stream: ResumableStream) => {
    const project = await projectRepo.getProjectById(projectId);

    type Character = z.infer<typeof CharacterSchema>;

    const onStart = async () => {
        await projectRepo.updateProject(projectId, { status: 'CHARACTER_BIBLE_GENERATION_IN_PROGRESS' });
    };

    const onFinish = async (characters: Character[], _totalUsage: number) => {
        // Upsert characters as entities
        if (characters.length > 0) {
            await projectRepo.cleanAndUpsertEntities(projectId, characters, 'CHARACTER');
        }

        // Get keyLocations from story_bible and upsert as LOCATION entities
        const updatedProject = await projectRepo.getProjectById(projectId);
        const keyLocations = updatedProject?.story_bible?.keyLocations ?? [];
        if (keyLocations.length > 0) {
            const locations: Location[] = keyLocations.map((loc) => ({
                name: loc.name,
                description: `${loc.description}. ${loc.significance}`,
            }));
            await projectRepo.cleanAndUpsertEntities(projectId, locations, 'LOCATION');
        }

        await projectRepo.updateProject(projectId, {
            status: 'CHARACTER_BIBLE_GENERATION_COMPLETED',
        });
    };

    const onError = async (_error: Error) => {
        await projectRepo.updateProject(projectId, { status: 'CHARACTER_BIBLE_GENERATION_FAILED' });
    };

    const onAbort = async () => {
        await projectRepo.updateProject(projectId, { status: 'CHARACTER_BIBLE_GENERATION_FAILED' });
    };

    await generateCharacterDevelopment({ project, stream, onStart, onFinish, onError, onAbort });
};

// ---------------------------------------------------------------------------
// Script Services
// ---------------------------------------------------------------------------

export const generateScriptOutlineService = async (projectId: string, stream: ResumableStream) => {
    const project = await projectRepo.getProjectById(projectId);

    const onStart = async () => {
        await projectRepo.updateProject(projectId, { status: 'OUTLINE_GENERATION_IN_PROGRESS' });
    };

    const onFinish = async (outline: ScriptOutline, _totalUsage: number) => {
        // Note: Script outline is streamed via delta events.
        // It can be stored if needed by adding a script_outline column.
        await projectRepo.updateProject(projectId, {
            status: 'OUTLINE_GENERATION_COMPLETED',
            outline 
        });
    };

    const onError = async (_error: Error) => {
        await projectRepo.updateProject(projectId, { status: 'OUTLINE_GENERATION_FAILED' });
    };

    const onAbort = async () => {
        await projectRepo.updateProject(projectId, { status: 'OUTLINE_GENERATION_FAILED' });
    };

    await generateScriptOutline({ project, stream, onStart, onFinish, onError, onAbort });
};

export const generateScriptScenes = async (
    projectId: string,
    stream: ResumableStream
) => {
    const project = await projectRepo.getProjectById(projectId);
    const scriptOutline = project?.outline;
    if (!scriptOutline) {
        throw new BadRequest('Script outline not found');
    }

    const onStart = async () => {
        await projectRepo.updateProject(projectId, { status: 'SCRIPT_GENERATION_IN_PROGRESS' });
    };

    const onFinish = async (script: ProseDocument, _totalUsage: number) => {
        await projectRepo.updateProject(projectId, {
            status: 'SCRIPT_GENERATION_COMPLETED',
            script,
        });
    };

    const onError = async (_error: Error) => {
        await projectRepo.updateProject(projectId, { status: 'SCRIPT_GENERATION_FAILED' });
    };

    const onAbort = async () => {
        await projectRepo.updateProject(projectId, { status: 'SCRIPT_GENERATION_FAILED' });
    };

    await generateScenes({ project, scriptOutline, stream, onStart, onFinish, onError, onAbort });
};

// ---------------------------------------------------------------------------
// Entity Services
// ---------------------------------------------------------------------------

export const regenerateEntity = async (projectId: string, entityId: string) => {
    const project = await projectRepo.getProjectById(projectId);
    const entity = await projectRepo.getEntityById(entityId);
    if (!entity) {
        throw new BadRequest('Entity not found');
    }

    if(entity.projectId !== projectId) {
        throw new BadRequest('Entity does not belong to project');
    }

    const stream = new ResumableStream(redis, projectId);

    const onStart = async () => {
        // await projectRepo.updateProject(projectId, { status: 'ENTITY_REGENERATION_IN_PROGRESS' });
    };

    const onFinish = async (entity: EntityObject, _totalUsage: number) => {
        await projectRepo.updateEntity(projectId, entityId, entity);
        // await projectRepo.updateProject(projectId, { status: 'ENTITY_REGENERATION_COMPLETED', entities: [...project.entities, entity] });
    };

    const onError = async (_error: Error) => {
        // await projectRepo.updateProject(projectId, { status: 'ENTITY_REGENERATION_FAILED' });
    };

    const onAbort = async () => {
        // await projectRepo.updateProject(projectId, { status: 'ENTITY_REGENERATION_FAILED' });
    };

    switch (entity.type) {
        // Fire and forget - run the job in the background
        case 'CHARACTER':
            regenerateCharacter({ project, currentCharacter: entity.metadata as Character, stream, onStart, onFinish, onError, onAbort });
            break;
        case 'LOCATION':
            regenerateLocation({ project, currentLocation: entity.metadata as Location, stream, onStart, onFinish, onError, onAbort });
            break;
        case 'PROP':
            regenerateProp({ project, currentProp: entity.metadata as Prop, stream, onStart, onFinish, onError, onAbort });
            break;
    }

    return { ok: true, streamId: projectId };
}
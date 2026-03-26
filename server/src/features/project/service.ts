import { projectModel, projectRepo } from "@/entities/project"
import * as error from '../error'
import * as aiService from "../ai/service";
import { EntityObject, NarrativeArcList, proseDocumentSchema } from "zSchemas";
import { Entity } from "@/db/schema";
import { convertScenesToProse, diffScenes, parseScenesFromProse } from "@/utils/script-sync-engine";
import { ProseDocument } from "@/type";
import { entityToProseDoc, proseDocToEntityMetadata } from "@/utils/entity-sync-engine";
import { proseDocToStoryBible, storyBibleToProseDoc } from "@/utils/world-sync-engine";

export const startProject = async (data: projectModel.CreateProject) => {
    // Save the project in db
    const project = await projectRepo.createProject(data);

    // lauch the concept generator job in the background
    await aiService.generateScriptComponents(project.id, 'concept');
    // Return the created project
    return {
        project,
    }
}

export const getProject = async (id: string) => {
    const project = await validateProject(id);
    const {story_bible_prose, 
           script,
           ...rest
          } = project;
    return rest;
}

export const deleteProject = async (id: string) => {
    const confirm = await projectRepo.deleteProject(id);
    return { confirmed: confirm };
}

export const updateProject = async (id: string, data: projectModel.UpdateProject) => {
    await validateProject(id);
    const project = await projectRepo.updateProject(id, data);
    if (data.script) {
        await syncScriptWithScenes(id, data.script);
    }
    return project;
}

export const listProjects = async () => {
    const projects = await projectRepo.listProjects();
    return projects;
}

export const selectNarrativeArc = async (id: string, arcs: NarrativeArcList) => {
    await validateProject(id);
    const selectedArc = arcs.filter(arc => arc.isSelected);
    if(selectedArc.length !== 1) {
        throw new error.BadRequest('You must select exactly one narrative arc');
    }
    await projectRepo.updateProject(id, { narrative_arcs: arcs });
    // lauch the synopsis generator job in the background
    await aiService.generateScriptComponents(id, 'synopsis');
    return { ok: true };
}

export const createEntity = async (id: string, data: EntityObject, type: Entity['type']) => {
    await validateProject(id);
    const entity = await projectRepo.createEntity(id, data, type);
    return entity;
}

export const listAllEntities = async (projectId: string,
    cursor?: string,
    pageSize = 20,
    entityType?: Entity['type']) => {
    await validateProject(projectId);
    const entities = await projectRepo.listEntities(projectId, cursor, pageSize, entityType);
    return entities;
}

export const getEntity = async (id: string, entityId: string) => {
    const entity = await validateEntity(id, entityId);
    if(entity.prose){
        return entity.prose;
    }
    return entityToProseDoc(entity);
}

export const saveEntityProse = async (id: string, entityId: string, prose: ProseDocument) => {
    const entity = await validateEntity(id, entityId);
    // TODO: Validate the prose before saving it
    try {
        const entityFromProse = proseDocToEntityMetadata(entity, prose);
        await projectRepo.saveEntityProse(id, entityId, {prose, metadata: entityFromProse});
        return entityFromProse;
    } catch (e) {
        throw new error.BadRequest('Invalid prose');
    }
}   

export async function returnStoryBibleProse(projectId: string) {
    const project = await validateProject(projectId);
    if (project.story_bible_prose) {
        return project.story_bible_prose;
    }
    if (project.story_bible) {
        return storyBibleToProseDoc(project.story_bible);
    }
    return { type: 'doc', content: [] } as ProseDocument;
}

export const saveStoryBibleProse = async (projectId: string, prose: ProseDocument) => {
    const project = await validateProject(projectId);
    try {
        const parsedProse = proseDocumentSchema.parse(prose);
        const storyBible = proseDocToStoryBible(project.story_bible ?? null, parsedProse);
        await projectRepo.updateProject(projectId, {
            story_bible: storyBible,
            story_bible_prose: parsedProse,
        });
        return parsedProse;
    } catch (_e) {
        throw new error.BadRequest('Invalid story bible prose');
    }
}

export const updateEntity = async (id: string, entityId: string, data: EntityObject) => {
    await validateEntity(id, entityId);
    const entity = await projectRepo.updateEntity(id, entityId, data);
    return entity;
}

export const deleteEntity = async (id: string) => {
    const entity = await projectRepo.deleteEntity(id);
    return { ok: entity ? true : false };
}

export async function returnScriptProse(projectId: string) {
    const project = await validateProject(projectId);
    if (project.script) {
        return project.script;
    }
    // If there is no script, check if we have scenes, if so, return the prose document
    const scenes = await projectRepo.getAllScenesForSync(projectId);
    
    if(scenes.length === 0) {
        return { type: 'doc', content: [] } as ProseDocument;
    }

    const prose = convertScenesToProse(scenes);
    // await projectRepo.updateProject(projectId, { script: prose });
    return prose;

}

async function syncScriptWithScenes(projectId: string, proseScript: ProseDocument){
    if(!proseScript) {
        return
    }
    const newScenes = parseScenesFromProse(proseScript)
    if(newScenes.length === 0) {
        return
    }
    const currentScenes = await projectRepo.getAllScenesForSync(projectId)
    if(currentScenes.length === 0) {
        await projectRepo.upsertScenes(projectId, newScenes)
        return
    }
    const diff = diffScenes(currentScenes, newScenes)
    const hasDeletes = diff.delete.length > 0
    const hasInserts = diff.insert.length > 0
    const hasMeaningfulUpdates = diff.update.some((update, index) => {
        const currentScene = currentScenes[index]
        return !currentScene
            || currentScene.id !== update.scene.id
            || JSON.stringify(currentScene.content) !== JSON.stringify(update.scene.content)
    })

    if (!hasDeletes && !hasInserts && !hasMeaningfulUpdates) {
        return
    }

    await projectRepo.upsertScenes(projectId, newScenes)
}

async function validateProject(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new error.NotFound('Project not found');
    }
    return project;
}

async function validateEntity(projectId: string, entityId: string) {
    const entity = await projectRepo.getEntityById(entityId);
    if (!entity) {
        throw new error.NotFound('Entity not found');
    }
    if (entity.projectId !== projectId) {
        throw new error.Forbidden('Entity does not belong to project');
    }
    return entity;
}
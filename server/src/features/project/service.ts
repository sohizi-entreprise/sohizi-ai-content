import { projectModel, projectRepo } from "@/entities/project"
import * as error from '../error'
import * as aiService from "../ai/service";
import { EntityObject, NarrativeArcList } from "zSchemas";
import { Entity } from "@/db/schema";

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
    return project;
}

export const deleteProject = async (id: string) => {
    const confirm = await projectRepo.deleteProject(id);
    return { confirmed: confirm };
}

export const updateProject = async (id: string, data: projectModel.UpdateProject) => {
    await validateProject(id);
    const project = await projectRepo.updateProject(id, data);
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
    return entity;
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
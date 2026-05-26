import * as error from '../error'
import * as projectRepo from "./repo";
import { z } from "zod";
import { createProjectSchema, createTemplateSchema, deleteProjectSchema, updateProjectSchema} from "./schema";

import { CursorPaginationOptions } from "@/type";
import { RepositoryError } from '../error';
import { generateSlug } from '@/utils/slug';

export const startProject = async (data: z.infer<typeof createProjectSchema>, organizationId: string) => {
    const project = await projectRepo.createProject(data, organizationId);
    return project;
}

export const createTemplate = async (data: z.infer<typeof createTemplateSchema>, organizationId: string) => {
    const {name} = data;
    const slug = generateSlug(name);
    if(!slug) {
        throw new error.BadRequest('Invalid name. Please use a name between 3 and 150 characters.');
    }
    const templatePayload = {
        name,
        slug,
    }
    try {
        const template = await projectRepo.createTemplate(templatePayload, organizationId);
        return template;
    } catch (e) {
        if(e instanceof RepositoryError) {
            switch(e.type) {
                case 'NotFound':
                case 'Conflict':
                    throw new error.BadRequest('Template with this name already exists');
                default:
                    throw new error.InternalServerError();
            }
        }
        throw new error.InternalServerError();
    }
}

export const getProject = async (id: string) => {
    try {
        return await projectRepo.getProjectWithRootFiles(id);
    } catch (e) {
        if(e instanceof RepositoryError) {
            switch(e.type) {
                case 'NotFound':
                    throw new error.NotFound(e.message);
                default:
                    throw new error.InternalServerError();
            }
        }
        throw new error.InternalServerError();
    }
}

export const deleteProject = async (data: z.infer<typeof deleteProjectSchema>) => {
    const {id, title} = data;
    const project = await validateProject(id);
    if(title !== project.title) {
        throw new error.BadRequest('Title does not match');
    }
    const confirm = await projectRepo.deleteProject(id);
    if(!confirm) {
        throw new error.InternalServerError('Failed to delete project. Try again later.');
    }
    return { confirmed: confirm };
}

export const updateProject = async (id: string, data: z.infer<typeof updateProjectSchema>) => {
    await validateProject(id);
    const updatedProject = await projectRepo.updateProject(id, data);
    return updatedProject;
}

export const listProjects = async (options: CursorPaginationOptions, organizationId: string) => {
    const projects = await projectRepo.listProjects(options, organizationId);
    return projects;
}

export const listTemplates = async (options: CursorPaginationOptions, organizationId: string) => {
    const templates = await projectRepo.listTemplates(options, organizationId);
    return templates;
}

export const listPublishedTemplates = async (options: CursorPaginationOptions) => {
    const templates = await projectRepo.listPublishedTemplates(options);
    return templates;
}

async function validateProject(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new error.NotFound('Project not found');
    }
    return project;
}
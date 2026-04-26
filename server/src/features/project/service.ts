import * as error from '../error'
import * as projectRepo from "./repo";
import { z } from "zod";
import { createProjectSchema, deleteProjectSchema, updateProjectSchema} from "./schema";

import { CursorPaginationOptions } from "@/type";

export const startProject = async (data: z.infer<typeof createProjectSchema>) => {
    // Save the project in db
    const project = await projectRepo.createProject(data);
    return project;
}

export const getProject = async (id: string) => {
    const project = await validateProject(id);
    return project;
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

export const listProjects = async (options: CursorPaginationOptions) => {
    const projects = await projectRepo.listProjects(options);
    return projects;
}

async function validateProject(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new error.NotFound('Project not found');
    }
    return project;
}
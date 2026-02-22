import { projectModel, projectRepo } from "@/entities/project"
import * as error from '../error'
import * as aiService from "../ai/service";

export const startProject = async (data: projectModel.CreateProject) => {
    // Save the project in db
    const project = await projectRepo.createProject(data);

    // Fire and forget - generate concepts
    aiService.generateScriptComponents(project.id, 'concept');
    // Return the created project
    return {
        project,
    }
}

export const getProject = async (id: string) => {
    const project = await projectRepo.getProjectById(id);
    if (!project) {
        throw new error.NotFound('Project not found');
    }
    return project;
}

export const deleteProject = async (id: string) => {
    const confirm = await projectRepo.deleteProject(id);
    return { confirmed: confirm };
}

export const updateProject = async (id: string, data: projectModel.UpdateProject) => {
    const existingProject = await projectRepo.getProjectById(id);
    if (!existingProject) {
        throw new error.NotFound('Project not found');
    }
    const project = await projectRepo.updateProject(id, data);
    return project;
}

export const listProjects = async () => {
    const projects = await projectRepo.listProjects();
    return projects;
}

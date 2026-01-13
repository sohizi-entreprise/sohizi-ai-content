import { projectModel, projectRepo } from "@/entities/project"
import { generationRequestModel, generationRequestRepo } from "@/entities/requests";
import * as error from '../error'

export const startProject = async (data: projectModel.CreateProject) => {

    // Save the project in db
    const project = await projectRepo.createProject(data);

    // Create a request to generate the brief
    const payload: generationRequestModel.GenerationRequest = {
        projectId: project.id,
        type: "GENERATE_BRIEF",
        prompt: (data.initialInput.type === "prompt")? data.initialInput.content : null,
    }
    const request = await generationRequestRepo.createGenerationRequest(payload);

    // Enqueue the request

    // Return the data along with the request id
    return {
        project,
        requestId: request.id,
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
    const project = await projectRepo.updateProject(id, data);
    return project;
}

export const listProjects = async () => {
    const projects = await projectRepo.listProjects();
    return projects;
}
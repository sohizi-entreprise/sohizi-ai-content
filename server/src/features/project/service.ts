import { projectModel, projectRepo } from "@/entities/project"
import { generationRequestModel, generationRequestRepo } from "@/entities/requests";

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
    return project;
}

export const deleteProject = async (id: string) => {
    const confirm = await projectRepo.deleteProject(id);
    return { confirmed: confirm };
}
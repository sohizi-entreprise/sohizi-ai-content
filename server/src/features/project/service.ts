import { projectModel, projectRepo } from "@/entities/project"
import * as error from '../error'
import * as aiService from "../ai/service";
import { NarrativeArcList } from "zSchemas";

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

export const selectNarrativeArc = async (id: string, arcs: NarrativeArcList) => {
    const project = await projectRepo.getProjectById(id);
    if (!project) {
        throw new error.NotFound('Project not found');
    }
    const selectedArc = arcs.filter(arc => arc.isSelected);
    if(selectedArc.length !== 1) {
        throw new error.BadRequest('You must select exactly one narrative arc');
    }
    await projectRepo.updateProject(id, { narrative_arcs: arcs });
    // lauch the synopsis generator job in the background
    await aiService.generateScriptComponents(id, 'synopsis');
    return { ok: true };
}

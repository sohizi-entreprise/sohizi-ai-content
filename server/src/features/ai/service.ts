import { projectRepo } from "@/entities/project";
import { NotFound, BadRequest, Forbidden } from "../error";
import { ResumableStream, redis } from "@/lib";
import { conceptGenerator } from "./script-engine/concept-generator";
import { NarrativeArcList, Synopsis } from "zSchemas";
import { Project } from "@/db/schema";
import { synopsisGenerator } from "./script-engine/synopsis-generator";

export const supportedScriptComponentTypes = ['concept', 'synopsis', 'outline', 'script', 'world_bible'] as const;
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

    const onFinish = async(synopsis: Synopsis, totalUsage: number) => {
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
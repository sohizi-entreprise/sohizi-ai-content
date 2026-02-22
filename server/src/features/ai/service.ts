import { projectRepo } from "@/entities/project";
import { NotFound, BadRequest } from "../error";
import { ResumableStream, redis } from "@/lib";
import { conceptGenerator } from "./script-engine/concept-generator";
import { NarrativeArcList } from "zSchemas";

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
            generateConcepts(projectId, stream);
            break;
    
        default:
            break;
    }

    return {ok: true, projectId}
}


export const generateConcepts = async (projectId: string, stream: ResumableStream) => {
    const project = await projectRepo.getProjectById(projectId);

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
import { projectRepo } from "@/entities/project";
import { NotFound } from "../error";
import { streamLlmText, streamLlmJson } from "@/lib/llm";
import { getWriterPrompt } from "./prompt";
import { projectConstants } from "@/constants";
import { BriefSchema } from "./schema";


export const generateBrief = async (projectId: string) => {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }

    const systemPrompt = getWriterPrompt({
        action: "WRITE",
        target: "brief",
        format: project.format as projectConstants.ProjectFormat
    })

    const userPrompt = `
    Project: ${project.name}
    ---
    Format: ${project.format}
    ---
    Tone: ${project.tone}
    ---
    Genre: ${project.genre}
    ---
    Audience: ${project.audience}
    ---
    Constraints: ${project.constraints || "None"}
    ---
    Idea to develop: ${project.initialInput?.content}
    `

    // Call the llm

    return await streamLlmJson({
        model: 'gpt-5.1',
        systemPrompt: systemPrompt,
        schema: BriefSchema,
        userPrompt: userPrompt,
        modelSettings: {
            temperature: 0.6,
            reasoningEffort: "low"
        },
        onFinish: ({totalTokens, json}) => {
            console.log("token usage: ", totalTokens, '\n=======\n')
            console.dir(json, { depth: 4, colors: true });
        },
        onError: (error) => {
            console.error("error: ", error)
        }
    })

}


export const generateScenes = async() => {

}

export const reviewBlock = async () => {

}


export const extractEntities = async () => {

}

export const generateShots = async () => {

}

export const generateImages = async () => {

}
import { projectRepo } from "@/entities/project";
import { NotFound } from "../error";
import { streamLlmText, streamLlmJson } from "@/lib/llm";
import { getWriterPrompt } from "./prompt";
import { projectConstants } from "@/constants";
import { BriefSchema, CorrectScriptSchema } from "./schema";


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

export const correctScript = async (payload: { brief: string, feedback: string, partsToEdit: string }) => {
    
    const systemPrompt = `
    You are a professional scriptwriter.
    Your job is to correct the script based on the user's feedback.
    You will be given a brief, a feedback, and the parts of the script to edit.
    You will need to correct the script based on the feedback and the parts of the script to edit.

    IMPORTANT OUTPUT RULES:
    - Keep the same id that will be sent to you in the <parts_to_edit> tag.
    - You should only edit and return the content of the parts that are sent to you in the <parts_to_edit> tag.
    - Do not write beyond the requested scope.
    `

    const userPrompt = `
    Correct the script based on the feedback and the parts of the script to edit.
    <feedback>
    ${payload.feedback}
    </feedback>
    <parts_to_edit>
    ${payload.partsToEdit}
    </parts_to_edit>
    <brief>
    ${payload.brief}
    </brief>
    `

    return await streamLlmJson({
        model: 'gpt-5.1',
        systemPrompt: systemPrompt,
        schema: CorrectScriptSchema,
        userPrompt: userPrompt,
        outputType: 'array',
        modelSettings: {
            // temperature: 0.6,
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
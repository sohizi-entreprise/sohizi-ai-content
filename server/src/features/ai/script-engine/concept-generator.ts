import { Project } from "@/db/schema";
import { SystemPromptBuilder } from "../prompts/promptBuilder";
import { identities } from "../prompts";
import { skills } from "../skills";
import { narrativeArcSchema, narrativeArcListSchema, NarrativeArcList, ProjectBrief } from "zSchemas";
import {Output, streamText} from 'ai';
import { openai } from "@/lib/llm-providers";
import { ResumableStream, StreamEvent } from "@/lib";
import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";

type conceptGeneratorParams = {
    project: Project;
    onStart: () => void | Promise<void>;
    onFinish: (narrativeArcs: NarrativeArcList, totalUsage: number) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
    stream: ResumableStream;
}

export async function conceptGenerator({ project, onStart, onFinish, onError, onAbort, stream }: conceptGeneratorParams) {

    if (!project.brief) {
        throw new Error('Project brief is required');
    }
    // Let's call the onStart callback, here we can update the project status
    await onStart();

    // Create an AbortController to cancel the LLM request when the stream is cancelled
    const abortController = new AbortController();

    // Generate a run_id for the stream
    const runId = uuidv4();

    try {
        // Send request to llm
        const response = streamText({
            model: openai('gpt-5.1'),
            system: buildConceptGeneratorSystemPrompt(),
            prompt: getUserPrompt(project.brief),
            abortSignal: abortController.signal,
            providerOptions:{
                openai: {
                    reasoningEffort: 'low'
                }
            },
            // output: Output.array({ element: narrativeArcSchema }),
            onFinish: async ({text, finishReason, totalUsage}) => {
                if (finishReason === "error") {
                    return;
                }
    
                try {
                    const narrativeArcs = narrativeArcListSchema.parse(JSON.parse(text)) as NarrativeArcList;
                    await onFinish(narrativeArcs, totalUsage.totalTokens || 0);
                } catch (error) {
                    onError(new Error("Error parsing narrative arcs"));
                }
            },
            onError: (error) => {
                if (error instanceof Error) {
                    onError(error);
                } else {
                    onError(new Error(JSON.stringify(error)));
                }
            },
            onAbort: () => {
                onAbort();
            }
        })

        for await (const chunk of response.fullStream){
            // Check if the stream is cancelled
            if (await stream.isCancelled()) {
                // Abort the LLM request to stop billing tokens
                abortController.abort();
                await stream.close()
                onAbort();
                return
            }
            let event: StreamEvent<unknown> | null = null;
            switch (chunk.type) {
                case "start":
                    console.log('started =======================');
                    event = {type: 'concept_start', data: {runId: runId}}
                    break;
                case "text-delta":
                    event = {type: 'concept_delta', data: {runId: runId, type: 'content', text: chunk.text}}
                    break;
        
                case "reasoning-delta":
                    event = {type: 'concept_delta', data: {runId: runId, type: 'reasoning', text: chunk.text}}
                    console.log('reasoning:', chunk.text);
                    break;

                case "finish":
                    event = {type: 'concept_end', data: {runId: runId}}
                    break;

                case "error":
                    console.log('error =======================', chunk.error);
                    const errorMessage = chunk.error instanceof Error ? chunk.error.message : String(chunk.error);
                    event = {type: 'concept_error', data: {runId: runId, error: errorMessage}}
                    break;
            }
            if (event) {
                await stream.push(event);
            }
        }

    } catch (error) {
        let errMsg = 'Unknown error';
        if (error instanceof Error) {
            errMsg = error.message;
            onError(error);
        } else {
            errMsg = String(error);
            onError(new Error(JSON.stringify(error)));
        }
        const event = {type: 'concept_error', data: {runId: runId, error: errMsg}} as const;
        await stream.push(event);
    } finally {
        await stream.push({type: 'concept_end', data: {runId: runId}});
        await stream.close();
    }

}


function buildConceptGeneratorSystemPrompt() {
    const systemPromptBuilder = new SystemPromptBuilder()
    const expectedOutput = z.array(narrativeArcSchema).describe('The output should be a JSON array of narrative arc concepts. Return only a valid json array, no other text or comments.')
    const jsonSchema = z.toJSONSchema(expectedOutput)
    const systemPrompt = systemPromptBuilder
        .addIdentity(identities.narrativeArcIdentity.default())
        .addSkills(skills.narrativeArc.default())
        .addOutputFormat(JSON.stringify(jsonSchema))
        .build()
    return systemPrompt
}

function getUserPrompt(brief: ProjectBrief) {
    return `
Generate 3 narrative arc concepts for the following project brief.
---
${JSON.stringify(brief)}
`
}
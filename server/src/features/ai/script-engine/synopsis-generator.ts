import { Project } from "@/db/schema";
import { SystemPromptBuilder } from "../prompts/promptBuilder";
import { identities } from "../prompts";
import { skills } from "../skills";
import { streamText } from 'ai';
import { openai } from "@/lib/llm-providers";
import { ResumableStream, StreamEvent } from "@/lib";
import { v4 as uuidv4 } from 'uuid';
import { parseSynopsisStreamToProse, type ProseDocument } from "./utils";

type Params = {
    project: Project;
    onStart: () => void | Promise<void>;
    onFinish: (synopsis: ProseDocument, totalUsage: number) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
    stream: ResumableStream;
}

export async function synopsisGenerator({ project, onStart, onFinish, onError, onAbort, stream }: Params) {

    // Generate a run_id for the stream
    const runId = uuidv4();
    
    const selectedArc = project.narrative_arcs?.find(arc => arc.isSelected);
    if (!selectedArc) {
        const errorMessage = 'You must select a narrative arc before generating a synopsis';
        const event = {type: 'synopsis_error', data: {runId: runId, error: errorMessage}} as const;
        await stream.push(event);
        await stream.close();
        onError(new Error(errorMessage));
        return;
    }
    // Let's call the onStart callback, here we can update the project status
    await onStart();

    // Create an AbortController to cancel the LLM request when the stream is cancelled
    const abortController = new AbortController();
    
    // Buffer to accumulate streamed JSON and map to preserve block IDs
    let jsonBuffer = '';
    const blockIdMap = new Map<number, string>();

    try {
        // Send request to llm
        const response = streamText({
            model: openai('gpt-5.1'),
            system: buildSystemPrompt(),
            prompt: getUserPrompt(project),
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
    
                // Parse final content to prose format
                const prose = parseSynopsisStreamToProse(text, blockIdMap);
                if (prose) {
                    await onFinish(prose, totalUsage.totalTokens || 0);
                } else {
                    onError(new Error("Error parsing synopsis to prose format"));
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
                    jsonBuffer = '';
                    event = {type: 'synopsis_start', data: {runId: runId}}
                    break;
                    
                case "text-delta":
                    // Accumulate JSON and parse to prose
                    jsonBuffer += chunk.text;
                    const prose = parseSynopsisStreamToProse(jsonBuffer, blockIdMap);
                    if (prose) {
                        event = {type: 'synopsis_delta', data: {runId: runId, type: 'prose', content: prose}}
                    } else if (jsonBuffer.length > 40) {
                        // If we have more than 40 characters, and still no prose, there is an error
                        event = {type: 'synopsis_error', data: {runId: runId, error: 'Error parsing synopsis to prose format. Please try again.'}}
                    }
                    break;
        
                case "reasoning-delta":
                    event = {type: 'synopsis_delta', data: {runId: runId, type: 'reasoning', text: chunk.text}}
                    break;

                case "finish":
                    event = {type: 'synopsis_end', data: {runId: runId}}
                    break;

                case "error":
                    const errorMessage = chunk.error instanceof Error ? chunk.error.message : String(chunk.error);
                    event = {type: 'synopsis_error', data: {runId: runId, error: errorMessage}}
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
        const event = {type: 'synopsis_error', data: {runId: runId, error: errMsg}} as const;
        await stream.push(event);
    } finally {
        await stream.push({type: 'synopsis_end', data: {runId: runId}});
        await stream.close();
    }

}


function buildSystemPrompt() {
    const systemPromptBuilder = new SystemPromptBuilder()
    const systemPrompt = systemPromptBuilder
        .addIdentity(identities.synopsisIdentity.default())
        .addSkills([skills.synopsis.default(), skills.synopsisProseFormat])
        .build()
    return systemPrompt
}

function getUserPrompt(project: Project) {
    const b = project.brief;
    return `
Generate a synopsis for the following ${project.brief.format} project.
---
Here is the initial project brief:
\`\`\`json
${JSON.stringify(project.brief)}
\`\`\`

Here is the selected narrative arc:
\`\`\`json
${JSON.stringify(project.narrative_arcs?.find(arc => arc.isSelected))}
\`\`\`
`
}
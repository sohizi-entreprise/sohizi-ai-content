import { streamLlmText } from "@/lib/llm";
import { z } from "zod";
import { BlockSchema } from "../schema";



type Params = {
    projectContext: string;
    blocksContext: string;
    systemPrompt: string;
    blockToWrite: z.infer<typeof BlockSchema>;
    feedback?: string;
    signal?: AbortSignal;
    onComplete?: (text: string) => void;
    onError?: (error: string) => void;
}


export async function blockWriter(
    { projectContext, blocksContext, systemPrompt, blockToWrite, feedback, signal, onComplete, onError }: Params
) {
    

    const userPrompt = buildUserPrompt(projectContext, blocksContext, blockToWrite, feedback);

    return await streamLlmText({
        model: 'gpt-5-nano',
        systemPrompt,
        userPrompt,
        abortSignal: signal,
        // modelSettings: {
        //     temperature: 0.75,
        //     reasoningEffort: "low"
        // },
        onFinish: ({ text }) => {
            onComplete?.(text);
        },
        onError: (error) => {
            onError?.(error);
        }
    });
}


function buildUserPrompt(
    projectContext: string,
    blocksContext: string,
    blockToWrite: Params['blockToWrite'],
    feedback?: string
) {
    return `

PROJECT CONTEXT:
${projectContext}

BLOCKS CONTEXT:
${blocksContext || "(This is the first block)"}

---

YOUR TASK: Write the following block:
- ID: ${blockToWrite.id}
- Type: ${blockToWrite.type}
- Parent: ${blockToWrite.parentId || "(root)"}
- Description: ${blockToWrite.content}

${feedback ? `
REVIEWER FEEDBACK (address these issues):
${feedback}
` : ''}
    
    `

}
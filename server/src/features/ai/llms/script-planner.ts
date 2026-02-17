import { streamLlmJson } from "@/lib/llm";
import { z } from "zod";
import { PlanSchema } from "../schema";


type Plan = z.infer<typeof PlanSchema>;

type Params = {
    projectContext: string;
    systemPrompt: string;
    signal?: AbortSignal;
    onComplete?: (plan: Plan) => void;
    onError?: (error: string) => void;
}

export async function scriptPlanner(
    { projectContext, systemPrompt, signal, onComplete, onError }: Params
){

    const userPrompt = `
Create a detailed structural plan for this script:

${projectContext}

Output the plan with title, logline, and all blocks that need to be written.
`;

    let finalPlan: Plan | null = null;

    return await streamLlmJson({
        model: 'gpt-5-nano',
        systemPrompt,
        userPrompt,
        schema: PlanSchema,
        abortSignal: signal,
        // modelSettings: {
        //     temperature: 0.7,
        //     reasoningEffort: "medium"
        // },
        onFinish: ({ json }) => {
            finalPlan = json as unknown as Plan;
            onComplete?.(finalPlan);
        },
        onError: (error) => {
            onError?.(error);
        }
    });
}
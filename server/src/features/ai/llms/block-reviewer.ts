import { streamLlmJson } from "@/lib/llm";
import { z } from "zod";
import { BlockSchema, ReviewSchema } from "../schema";

type Review = z.infer<typeof ReviewSchema>;

type Params = {
    projectContext: string;
    scriptPlan: string;
    systemPrompt: string;
    blockToReview: z.infer<typeof BlockSchema>;
    signal?: AbortSignal;
    onComplete?: (review: Review) => void;
    onError?: (error: string) => void;
}

export async function blockReviewer(
    { projectContext, scriptPlan, systemPrompt, blockToReview, signal, onComplete, onError }: Params
){
    
    const userPrompt = buildUserPrompt(projectContext, scriptPlan, blockToReview);

    let finalReview: Review | null = null;

    return await streamLlmJson({
        model: 'gpt-5-nano',
        systemPrompt,
        userPrompt,
        schema: ReviewSchema,
        abortSignal: signal,
        // modelSettings: {
        //     temperature: 0.3,
        //     reasoningEffort: "medium"
        // },
        onFinish: ({ json }) => {
            finalReview = json as Review;
            onComplete?.(finalReview);
        },
        onError: (error) => {
            onError?.(error);
        }
    });

}


function buildUserPrompt(
    projectContext: string,
    scriptPlan: string,
    blockToReview: Params['blockToReview'],
) {
    return `
PROJECT REQUIREMENTS:
${projectContext}

---

HERE IS THE SCRIPT STRUCTURE PLAN:
${scriptPlan}

---

CONTENT THAT NEEDS TO BE REVIEWED:
Block ID: ${blockToReview.id}
Block Type: ${blockToReview.type}
Parent: ${blockToReview.parentId || "root"}
Content:

${blockToReview.content}

---

Review this content strictly. Check for AI patterns, authenticity, and project alignment.
Be specific about issues and provide actionable suggestions.

`
}
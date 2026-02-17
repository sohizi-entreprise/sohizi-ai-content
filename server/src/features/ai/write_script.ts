import { projectRepo } from "@/entities/project";
import { streamLlmJson, streamLlmText } from "@/lib/llm";
import { projectConstants } from "@/constants";
import { z } from "zod";
import { BlockSchema, PlanSchema, ReviewSchema, StatusEventSchema, PlanBlockSchema } from "./schema";
import { StreamBus } from "./stream-bus";
import { scriptPlanner } from "./llms/script-planner";
import { getPlannerPrompt } from "./prompts/planner";
import { createProjectContext } from "./utils";
import { getWriterPrompt } from "./prompts/writer";
import { blockReviewer, blockWriter } from "./llms";
import { getReviewerPrompt } from "./prompts/reviewer";

// ============================================================================
// SCHEMAS
// ============================================================================

type Block = z.infer<typeof BlockSchema>;
type Plan = z.infer<typeof PlanSchema>;
type Review = z.infer<typeof ReviewSchema>;
type StatusEvent = z.infer<typeof StatusEventSchema>;
type ProjectData = Awaited<ReturnType<typeof projectRepo.getProjectById>>;



// ============================================================================
// AGENT FUNCTIONS
// ============================================================================


async function* planAgent(
    project: NonNullable<ProjectData>,
    signal?: AbortSignal
): AsyncGenerator<{ type: "chunk"; data: Partial<Plan> } | { type: "complete"; data: Plan } | { type: "error"; message: string }> {
    const systemPrompt = getPlannerPrompt(project.format as projectConstants.ProjectFormat);
    const userPrompt = `
Create a detailed structural plan for this script:

${createProjectContext(project)}

Output the plan with title, logline, and all blocks that need to be written.
`;

    let finalPlan: Plan | null = null;

    try {
        // Check if already aborted
        if (signal?.aborted) {
            yield { type: "error", message: "Operation cancelled" };
            return;
        }

        const stream = await streamLlmJson({
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
            },
            onError: (error) => {
                console.error("Plan agent error:", error);
            }
        });

        // Stream each partial chunk
        for await (const chunk of stream) {
            yield { type: "chunk", data: chunk as Partial<Plan> };
        }

        if (!finalPlan) {
            yield { type: "error", message: "Planning failed to produce output" };
            return;
        }

        yield { type: "complete", data: finalPlan };
    } catch (error) {
        console.log('planAgent error:', error);
        yield { type: "error", message: error instanceof Error ? error.message : String(error) };
    }
}

async function writeAgent(
    project: NonNullable<ProjectData>,
    plan: Plan,
    blockToWrite: z.infer<typeof PlanBlockSchema>,
    previousBlocks: Block[],
    feedback?: string,
    signal?: AbortSignal
) {
    const systemPrompt = getWriterPrompt(project.format as projectConstants.ProjectFormat);
    
    const contextBlocks = previousBlocks
        .map(b => `[${b.type.toUpperCase()}:${b.id}] ${b.content}`)
        .join('\n\n');

    const userPrompt = `
${createProjectContext(project)}

SCRIPT PLAN:
Title: ${plan.title}
Logline: ${plan.logline}

PREVIOUSLY WRITTEN CONTENT:
${contextBlocks || "(This is the first block)"}

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
`;

    return await streamLlmText({
        model: 'gpt-5-nano',
        systemPrompt,
        userPrompt,
        // schema: BlockSchema,
        abortSignal: signal,
        // modelSettings: {
        //     temperature: 0.75,
        //     reasoningEffort: "low"
        // },
        onError: (error) => {
            console.error("Write agent error:", error);
        }
    });
}

async function* reviewAgent(
    project: NonNullable<ProjectData>,
    block: Block,
    plan: Plan,
    signal?: AbortSignal
): AsyncGenerator<{ type: "chunk"; data: Partial<Review> } | { type: "complete"; data: Review }> {
    const systemPrompt = getReviewerPrompt();
    
    const userPrompt = `
PROJECT REQUIREMENTS:
- Tone: ${project.tone}
- Audience: ${project.audience}
- Genre: ${project.genre}
- Format: ${project.format}

SCRIPT CONTEXT:
Title: ${plan.title}
Logline: ${plan.logline}

CONTENT TO REVIEW:
Block ID: ${block.id}
Block Type: ${block.type}
Content:
---
${block.content}
---

Review this content strictly. Check for AI patterns, authenticity, and project alignment.
Be specific about issues and provide actionable suggestions.
`;

    let finalReview: Review | null = null;

    try {
        // Check if already aborted
        if (signal?.aborted) {
            yield { 
                type: "complete", 
                data: {
                    approved: true,
                    score: 7,
                    issues: [],
                    overallFeedback: "Review cancelled."
                }
            };
            return;
        }

        const stream = await streamLlmJson({
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
            },
            onError: (error) => {
                console.error("Review agent error:", error);
            }
        });

        // Stream each partial chunk
        for await (const chunk of stream) {
            yield { type: "chunk", data: chunk as Partial<Review> };
        }

        if (!finalReview) {
            // Default to approved if review fails
            finalReview = {
                approved: true,
                score: 7,
                issues: [],
                overallFeedback: "Review unavailable, proceeding with content."
            };
        }

        yield { type: "complete", data: finalReview };
    } catch (error) {
        // On error, default to approved
        yield { 
            type: "complete", 
            data: {
                approved: true,
                score: 7,
                issues: [],
                overallFeedback: "Review failed, proceeding with content."
            }
        };
    }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

const MAX_REVIEW_ITERATIONS = 1;

type PlanChunkEvent = { type: "plan_chunk"; data: Partial<Plan> }
type PlanCompleteEvent = { type: "plan_complete"; data: Plan }
type BlockChunkEvent = { type: "block"; data: Partial<Block> }
type BlockCompleteEvent = { type: "block_complete"; data: Block }
type ReviewChunkEvent = { type: "review_chunk"; data: { blockId: string; chunk: Partial<Review> } }
type ReviewCompleteEvent = { type: "review_complete"; data: { blockId: string; review: Review } }
type ErrorEvent = { type: "error"; data: { message: string } }

export type ScriptWriterEvent = 
    | { type: "status"; data: StatusEvent }
    | PlanChunkEvent
    | { type: "plan_complete"; data: Plan }
    | BlockChunkEvent
    | BlockCompleteEvent
    | ReviewChunkEvent
    | ReviewCompleteEvent
    | { type: "review"; data: { blockId: string; review: Review; iteration: number } }
    | { type: "complete"; data: { blocks: Block[] } }
    | ErrorEvent;


export async function* writeScript(projectId: string, signal?: AbortSignal): AsyncGenerator<ScriptWriterEvent> {
    // Helper to check if operation was cancelled
    const checkCancelled = (): boolean => signal?.aborted ?? false;
    
    // Fetch project
    let project: NonNullable<ProjectData> | null = null;
    
    try {
        project = await projectRepo.getProjectById(projectId);
    } catch (error) {
        yield { type: "error", data: { message: `Failed to fetch project: ${error instanceof Error ? error.message : String(error)}` } };
        return;
    }
    
    if (!project) {
        yield { type: "error", data: { message: "Project not found" } };
        return;
    }

    // Check if cancelled before starting
    if (checkCancelled()) {
        yield { type: "error", data: { message: "Operation cancelled" } };
        return;
    }

    const emitStatus = (event: StatusEvent): ScriptWriterEvent => ({ type: "status", data: event });

    try {
        // =====================================================================
        // PHASE 1: PLANNING (with streaming)
        // =====================================================================
        yield emitStatus({ type: "planning", message: "Starting script planning..." });

        let plan: Plan | null = null;
        for await (const planEvent of planScript(
            project, 
            signal
        )) {
            if (planEvent.type === "plan_complete") {
                plan = planEvent.data;
            }
            yield planEvent;
        }

        if (!plan) {
            yield { type: "error", data: { message: "Planning failed to produce output" } };
            return;
        }

        // Check for cancellation after planning
        if (checkCancelled()) {
            yield { type: "error", data: { message: "Operation cancelled" } };
            return;
        }

        yield emitStatus({ 
            type: "planning", 
            message: `Plan created: "${plan.title}" with ${plan.structure.length} blocks` 
        });

        // =====================================================================
        // PHASE 2 & 3: WRITE + REVIEW LOOP
        // =====================================================================
        const completedBlocks: Block[] = [];

        // Add title and logline as initial blocks
        const titleBlock: Block = {
            id: "title_1",
            parentId: "root",
            type: "title",
            content: plan.title
        };
        const loglineBlock: Block = {
            id: "logline_1", 
            parentId: "root",
            type: "logline",
            content: plan.logline
        };

        completedBlocks.push(titleBlock, loglineBlock);
        yield { type: "block", data: titleBlock };
        yield { type: "block", data: loglineBlock };

        // Process each block in the plan
        for (const blockPlan of plan.structure) {
            // Check for cancellation before each block
            if (checkCancelled()) {
                yield { type: "error", data: { message: "Operation cancelled" } };
                return;
            }

            if (blockPlan.type === 'segment' || blockPlan.type === 'segmentSummary'){
                const segmentBlock: Block = {
                    id: blockPlan.id,
                    parentId: blockPlan.parentId,
                    type: blockPlan.type,
                    content: blockPlan.content
                };
                completedBlocks.push(segmentBlock);
                yield { type: "block", data: segmentBlock };
                continue;
            }
            
            let currentBlock: Block | null = null;
            let reviewIteration = 2;
            let feedback: string | undefined = undefined;

            // First we write the block
            const writeStream = writeScriptBlock(
                project,
                blockPlan,
                completedBlocks,
                undefined,
                signal,
                (block) => {
                    currentBlock = block;
                }
            );

            for await (const writeEvent of writeStream) {
                yield writeEvent;
            }

            while (reviewIteration > 0) {
                reviewIteration--;
                // Check for cancellation at start of each iteration
                if (checkCancelled()) {
                    yield { type: "error", data: { message: "Operation cancelled" } };
                    return;
                }
                
                // WRITE PHASE
                const isRevision = reviewIteration > 0;
                yield emitStatus({
                    type: isRevision ? "revision" : "writing",
                    blockId: blockPlan.id,
                    iteration: reviewIteration,
                    message: isRevision 
                        ? `Revising ${blockPlan.type} (attempt ${reviewIteration + 1})...`
                        : `Writing ${blockPlan.type}: ${blockPlan.content}`
                });

                // Stream the writing
                let writeStream;
                try {
                    writeStream = await writeAgent(
                        project,
                        plan,
                        blockPlan,
                        completedBlocks,
                        feedback,
                        signal
                    );
                } catch (error) {
                    // Check if this was a cancellation
                    if (checkCancelled()) {
                        yield { type: "error", data: { message: "Operation cancelled" } };
                        return;
                    }
                    yield { type: "error", data: { message: `Write agent failed: ${error instanceof Error ? error.message : String(error)}` } };
                    // Use plan description as fallback
                    currentBlock = {
                        id: blockPlan.id,
                        parentId: blockPlan.parentId,
                        type: blockPlan.type as Block["type"],
                        content: blockPlan.content
                    };
                    break;
                }

                let writtenBlock: Partial<Block> = {};
                try {
                    for await (const partial of writeStream) {
                        // Check for cancellation during writing
                        if (checkCancelled()) {
                            yield { type: "error", data: { message: "Operation cancelled" } };
                            return;
                        }
                        // writtenBlock = { ...writtenBlock, ...partial };
                        writtenBlock = { id: blockPlan.id, type: blockPlan.type as Block["type"], content: partial };
                        yield { type: "block", data: writtenBlock };
                    }
                } catch (error) {
                    // Check if this was a cancellation
                    if (checkCancelled()) {
                        yield { type: "error", data: { message: "Operation cancelled" } };
                        return;
                    }
                    yield { type: "error", data: { message: `Write stream failed: ${error instanceof Error ? error.message : String(error)}` } };
                    // Use plan description as fallback
                    currentBlock = {
                        id: blockPlan.id,
                        parentId: blockPlan.parentId,
                        type: blockPlan.type as Block["type"],
                        content: blockPlan.content
                    };
                    break;
                }

                // Validate written block
                if (!writtenBlock.content || !writtenBlock.type) {
                    yield emitStatus({ type: "error", message: `Failed to write block ${blockPlan.id}, using fallback` });
                    // Use plan description as fallback
                    currentBlock = {
                        id: blockPlan.id,
                        parentId: blockPlan.parentId,
                        type: blockPlan.type as Block["type"],
                        content: blockPlan.content
                    };
                    break;
                }

                currentBlock = {
                    id: writtenBlock.id || blockPlan.id,
                    parentId: writtenBlock.parentId || blockPlan.parentId,
                    type: writtenBlock.type,
                    content: writtenBlock.content
                };

                // REVIEW PHASE (skip for last iteration)
                if (reviewIteration < MAX_REVIEW_ITERATIONS) {
                    // Check for cancellation before review
                    if (checkCancelled()) {
                        yield { type: "error", data: { message: "Operation cancelled" } };
                        return;
                    }
                    
                    yield emitStatus({
                        type: "reviewing",
                        blockId: blockPlan.id,
                        iteration: reviewIteration,
                        message: `Reviewing ${blockPlan.type}...`
                    });

                    let review: Review | null = null;
                    
                    // Stream review chunks
                    for await (const reviewEvent of reviewAgent(project, currentBlock, plan, signal)) {
                        // Check for cancellation during review
                        if (checkCancelled()) {
                            yield { type: "error", data: { message: "Operation cancelled" } };
                            return;
                        }
                        
                        if (reviewEvent.type === "chunk") {
                            yield { type: "review_chunk", data: { blockId: blockPlan.id, chunk: reviewEvent.data } };
                        } else if (reviewEvent.type === "complete") {
                            review = reviewEvent.data;
                        }
                    }
                    
                    if (!review) {
                        review = {
                            approved: true,
                            score: 7,
                            issues: [],
                            overallFeedback: "Review unavailable, proceeding with content."
                        };
                    }
                    
                    yield { 
                        type: "review", 
                        data: { 
                            blockId: blockPlan.id, 
                            review, 
                            iteration: reviewIteration 
                        } 
                    };

                    if (review.approved && review.score >= 7) {
                        yield emitStatus({
                            type: "reviewing",
                            blockId: blockPlan.id,
                            message: `Approved with score ${review.score}/10`
                        });
                        break; // Exit review loop, block is good
                    }

                    // Prepare feedback for revision
                    const issuesFeedback = review.issues
                        .map(i => `[${i.severity.toUpperCase()}] ${i.description}\n  → ${i.suggestion}\n  Affected: "${i.affectedContent}"`)
                        .join('\n\n');

                    feedback = `
SCORE: ${review.score}/10 - NOT APPROVED

ISSUES TO FIX:
${issuesFeedback}

OVERALL FEEDBACK:
${review.overallFeedback}

Please rewrite addressing ALL issues above.
`.trim();

                    reviewIteration++;
                } else {
                    // Max iterations reached, accept current version
                    yield emitStatus({
                        type: "reviewing",
                        blockId: blockPlan.id,
                        message: `Max revisions reached, accepting current version`
                    });
                    break;
                }
            }

            // Add completed block
            if (currentBlock) {
                completedBlocks.push(currentBlock);
            }
        }

        // =====================================================================
        // COMPLETE
        // =====================================================================
        yield emitStatus({
            type: "complete",
            message: `Script complete: ${completedBlocks.length} blocks written`
        });

        yield { type: "complete", data: { blocks: completedBlocks } };

    } catch (error) {
        yield { 
            type: "error", 
            data: { message: error instanceof Error ? error.message : String(error) } 
        };
    }
}

// ============================================================================
// STREAM WRAPPER FOR HTTP RESPONSE
// ============================================================================

export async function writeScriptStream(projectId: string): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder();
    const bus = new StreamBus<ScriptWriterEvent>();
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                for await (const event of writeScript(projectId)) {
                    const data = JSON.stringify(event);
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();
            } catch (error) {
                const errorEvent: ScriptWriterEvent = {
                    type: "error",
                    data: { message: error instanceof Error ? error.message : String(error) }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                controller.close();
            }
        }
    });
}


async function* planScript(
    project: NonNullable<ProjectData>, 
    signal?: AbortSignal,
    onComplete?: (plan: Plan) => void
): AsyncGenerator<PlanChunkEvent | PlanCompleteEvent | ErrorEvent> {
    const systemPrompt = getPlannerPrompt(project.format);
    const projectContext = createProjectContext(project)

    try {
        if (signal?.aborted) {
            return null;
        }

        let finalPlan: Plan | null = null;

        const planStream = await scriptPlanner({
            systemPrompt,
            projectContext,
            signal,
            onComplete: (plan) => {
                finalPlan = plan;
                onComplete?.(plan);
            },
            onError: (error) => {
                throw new Error(error);
            }
        });

        for await (const chunk of planStream) {
            if (signal?.aborted) {
                yield { type: "error", data: { message: "Operation cancelled" } };
                return;
            }
            yield { type: "plan_chunk", data: chunk as Partial<Plan> };
        }

        // After stream completes, yield the complete plan if we have it
        if (finalPlan) {
            yield { type: "plan_complete", data: finalPlan };
        }
        
    } catch (error) {
        yield { type: "error", data: { message: error instanceof Error ? error.message : String(error) } };
    }

}


async function* writeScriptBlock(
    project: NonNullable<ProjectData>,
    blockToWrite: z.infer<typeof PlanBlockSchema>,
    previousBlocks: Block[],
    feedback?: string,
    signal?: AbortSignal,
    onComplete?: (block: Block) => void
): AsyncGenerator<BlockChunkEvent | BlockCompleteEvent | ErrorEvent> {
    const systemPrompt = getWriterPrompt(project.format as projectConstants.ProjectFormat);
    
    const contextBlocks = previousBlocks
        .map(b => `[${b.type.toUpperCase()}:${b.id}] ${b.content}`)
        .join('\n\n');

    try {
        if (signal?.aborted) {
            return null;
        }

        let finalBlock: Block | null = null;

        const stream = await blockWriter({
            projectContext: createProjectContext(project),
            blocksContext: contextBlocks,
            systemPrompt,
            blockToWrite,
            feedback,
            signal,
            onComplete: (text) => {
                const newBlock = { id: blockToWrite.id, type: blockToWrite.type as Block["type"], parentId: blockToWrite.parentId, content: text };
                finalBlock = newBlock;
                onComplete?.(newBlock);
            },
            onError: (error) => {
                throw new Error(error);
            }
        })
        for await (const chunk of stream) {
            if (signal?.aborted) {
                yield { type: "error", data: { message: "Operation cancelled" } };
                return;
            }
            const writtenBlock = { id: blockToWrite.id, type: blockToWrite.type as Block["type"], parentId: blockToWrite.parentId, content: chunk };
            yield { type: "block", data: writtenBlock }
        }

        // After stream completes, yield the complete block if we have it
        if (finalBlock) {
            yield { type: "block_complete", data: finalBlock };
        }
        
    } catch (error) {
        yield { type: "error", data: { message: error instanceof Error ? error.message : String(error) } };
        
    }
}

async function* reviewWrittenBlock(
    project: NonNullable<ProjectData>,
    block: Block,
    plan: Plan,
    signal?: AbortSignal,
    onComplete?: (review: Review) => void
): AsyncGenerator<ReviewChunkEvent | ReviewCompleteEvent | ErrorEvent> {

    const systemPrompt = getReviewerPrompt();
    const scriptStructure = `
Script structure plan:
${JSON.stringify(plan.structure)}

`;

    try {
        // Check if already aborted
        if (signal?.aborted) {
            yield { type: "error", data: { message: "Operation cancelled" } };
            return;
        }

        let finalReview: Review | null = null;

        const stream = await blockReviewer({
            projectContext: createProjectContext(project),
            scriptPlan: scriptStructure,
            systemPrompt,
            blockToReview: block,
            signal,
            onComplete: (review) => {
                finalReview = review;
                onComplete?.(review);
            },
            onError: (error) => {
                throw new Error(error);
            }
        });

        // Stream each partial chunk
        for await (const chunk of stream) {
            if (signal?.aborted) {
                yield { type: "error", data: { message: "Operation cancelled" } };
                return;
            }
            yield { type: "review_chunk", data: { blockId: block.id, chunk: chunk as Partial<Review> } };
        }

        // After stream completes, yield the complete review if we have it
        if (finalReview) {
            yield { type: "review_complete", data: { blockId: block.id, review: finalReview } };
        }

    } catch (error) {
        yield { type: "error", data: { message: error instanceof Error ? error.message : String(error) } };
    }
}


// ============================================================================
// EXPORTS
// ============================================================================

export { BlockSchema, PlanSchema, ReviewSchema, StatusEventSchema };
export type { Block, Plan, Review, StatusEvent };

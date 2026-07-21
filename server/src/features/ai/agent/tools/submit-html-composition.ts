import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { success } from "./utils";
import {
    buildHtmlCompositionSubmission,
    setHtmlCompositionBlocked,
    setHtmlCompositionSubmission,
} from "@/features/media-engine/html-composition";

const submitHtmlCompositionDoneSchema = z.object({
    status: z.literal('done').describe('Composition is ready to submit.'),
    html: z.string().min(1).describe(
        'Complete self-contained HyperFrames HTML composition (inline CSS/JS). GSAP is provided by the host — do not include a gsap script tag.',
    ),
    name: z.string().min(1).max(200).optional().describe('Short display name for the asset'),
    duration: z.number().positive().max(600).describe('Total composition duration in seconds'),
    width: z.number().int().positive().max(7680).optional().describe('Composition width in pixels. Default 1920.'),
    height: z.number().int().positive().max(4320).optional().describe('Composition height in pixels. Default 1080.'),
});

const submitHtmlCompositionBlockedSchema = z.object({
    status: z.literal('blocked').describe('Cannot produce a composition for this request.'),
    message: z.string().min(1).max(500).describe('Concise reason you cannot proceed.'),
});

const submitHtmlCompositionSchema = z.discriminatedUnion('status', [
    submitHtmlCompositionDoneSchema,
    submitHtmlCompositionBlockedSchema,
]);

export type SubmitHtmlCompositionDoneInput = z.infer<typeof submitHtmlCompositionDoneSchema>;
export type SubmitHtmlCompositionInput = z.infer<typeof submitHtmlCompositionSchema>;

export const submitHtmlCompositionTool = buildBaseTool({
    name: 'submitHtmlComposition',
    description:
        'End the loop. Call EXACTLY ONCE. Use status "done" with the finished HTML composition, or status "blocked" with a short reason if you cannot proceed.',
    inputSchema: submitHtmlCompositionSchema,
    execute: async (input, { state, session }) => {
        if (state.isExitStatus) {
            return success('HTML composition was already submitted.');
        }

        if (input.status === 'blocked') {
            setHtmlCompositionBlocked(session.runId, input.message);
            state.finishRun();
            return success(JSON.stringify({ status: 'blocked', message: input.message }));
        }

        const submission = buildHtmlCompositionSubmission(input);
        setHtmlCompositionSubmission(session.runId, submission);
        state.finishRun();

        // Keep tool-result small — full HTML is handed off via the in-process store.
        return success(JSON.stringify({
            status: 'done',
            name: submission.name,
            duration: submission.duration,
            width: submission.width,
            height: submission.height,
        }));
    },
});

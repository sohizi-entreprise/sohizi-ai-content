import { z } from "zod";
import type { ProseDocument, ProseNode } from "@/type";
import { FILE_FORMATS } from "./constants";

const proseTextNodeSchema = z.object({
    type: z.literal('text'),
    text: z.string().optional(),
})

export const proseNodeSchema: z.ZodType<ProseNode> = z.lazy(() =>
    z.object({
        type: z.string(),
        attrs: z.record(z.string(), z.unknown()).optional(),
        content: z.array(z.union([proseTextNodeSchema, proseNodeSchema])).optional(),
        text: z.string().optional(),
    })
)

export const proseDocumentSchema: z.ZodType<ProseDocument> = z.object({
    type: z.literal('doc'),
    content: z.array(proseNodeSchema),
})

export const fileCreationRequestSchema = z.object({
    projectId: z.string(),
    name: z.string().max(50, 'Name must be less than 50 characters'),
    directory: z.boolean(),
    parentId: z.string().nullable(),
    position: z.number().gte(0, 'Position must be greater than 0'),
    format: z.enum(FILE_FORMATS).nullable(),
}).superRefine((data, ctx) => {
    if (data.directory) {
        if(data.format){
            ctx.addIssue({
                code: 'custom',
                message: 'Format is not allowed for directories',
                path: ['format'],
            })
        }
    }else{
        if(!data.format){
            ctx.addIssue({
                code: 'custom',
                message: 'Format is required for files',
                path: ['format'],
            })
        }
    }
})

export const fileNodeInsertPositionSchema = z.enum(['start', 'end', 'before', 'after']);

export const updateFileRequestSchema = z.object({
    id: z.string(),
    name: z.string().max(50, 'Name must be less than 50 characters').optional(),
    parentId: z.string().nullable().optional(),
    anchorId: z.string().nullable().optional(),
    position: fileNodeInsertPositionSchema.optional(),
}).superRefine((data, ctx) => {
    if (
        data.name === undefined
        && data.parentId === undefined
        && data.anchorId === undefined
        && data.position === undefined
    ) {
        ctx.addIssue({
            code: 'custom',
            message: 'At least one update field must be provided',
            path: ['name', 'parentId', 'anchorId', 'position'],
        })
    }

    if ((data.position === 'before' || data.position === 'after') && !data.anchorId) {
        ctx.addIssue({
            code: 'custom',
            message: `anchorId is required when position is ${data.position}`,
            path: ['anchorId'],
        })
    }

    if (data.anchorId !== undefined && data.position === undefined) {
        ctx.addIssue({
            code: 'custom',
            message: 'position is required when anchorId is provided',
            path: ['position'],
        })
    }
})

export const updateFilePositionRequestSchema = z.object({
    id: z.string(),
    anchorId: z.string().nullable().optional(),
    position: fileNodeInsertPositionSchema,
}).superRefine((data, ctx) => {
    if ((data.position === 'before' || data.position === 'after') && !data.anchorId) {
        ctx.addIssue({
            code: 'custom',
            message: `anchorId is required when position is ${data.position}`,
            path: ['anchorId'],
        })
    }
})

export const updateFileContentRequestSchema = z.object({
    content: z.string().optional(),
    jsonContent: z.record(z.string(), z.any()).optional(),
    proseContent: proseDocumentSchema.optional(),
}).refine((data) => {
    return data.content || data.jsonContent || data.proseContent;
}, {
    message: 'At least one of content attribute must be provided',
    path: ['content', 'jsonContent', 'proseContent'],
})

// z.object({
//     id: z.string(),
//     name: z.string().max(50, 'Name must be less than 50 characters').optional(),
//     parentId: z.string().nullable().optional(),
//     position: z.number().gte(0, 'Position must be greater than 0').optional(),
// })

export type UpdateFilePositionRequest = z.infer<typeof updateFilePositionRequestSchema>;
export type UpdateFileRequest = z.infer<typeof updateFileRequestSchema>;
export type UpdateFileContentRequest = z.infer<typeof updateFileContentRequestSchema>;
export type FileCreationRequest = z.infer<typeof fileCreationRequestSchema>;
export type FileNodeInsertPosition = z.infer<typeof fileNodeInsertPositionSchema>;
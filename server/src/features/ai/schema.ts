import { z } from "zod";

export const SceneSchema = z.object({
    id: z.string().describe("Unique identifier for the scene. It combines the segment id and the scene number (e.g., 'seg1_scene1'). Stable across regenerations."),
    order: z.number().describe("Scene order within the act. Example: 1, 2, 3, etc."),
    title: z.string().describe("Human-readable title for the scene"),
    summary: z.string().describe("Short summary of what happens in this scene and why it matters."),
})

export const SegmentSchema = z.object({
    id: z.string().describe("Unique identifier for the segment. It combines the prefix `seg` and the segment number (e.g., 'seg1', 'seg2', 'seg3', etc.). Stable across regenerations."),
    order: z.number().describe("Segment order within the project. Example: 1, 2, 3, etc."),
    title: z.string().describe("Human-readable title for the act (e.g., 'Setup', 'Escalation')"),
    summary: z.string().describe("Short summary of what happens in this segment and why it matters"),
    goals: z.array(z.string()).describe("High-level narrative goals for this segment"),
    turningPoints: z.array(z.string()).describe("Key turning points/reveals within this segment"),
    scenes: z.array(SceneSchema).describe("List of scenes that belong to this segment"),
})

export const BriefSchema = z.object({
    title: z.string().describe("Project title"),
    logline: z.string().describe("One-sentence premise/logline"),
    audience: z.enum(["general", "kids", "teens", "adult"]).describe("The intended audience group"),
    tone: z.string().describe("Tone descriptor (e.g., cozy, suspenseful, comedic, serious)"),
    genre: z.string().describe("Genre descriptor (e.g., mystery, horror, history, drama)"),
    format: z.enum(["storytime", "explainer"]).describe("The format of the video"),
    segments: z.array(SegmentSchema).describe("List of main parts that structure the story. You can have 3-7 segments depending on the format and content."),
})

/*
Structure blocks:
- section - arbitrary grouping (acts, chapters, "parts", "Hook", etc...)
- logline – one-sentence premise
- outline – ordered bullet outline (useful for storytime/explainers)
- objective – what the audience should feel/think/do (great for ads)

Building blocks:
- scene – a scene container (time/place, purpose, conflict)
- shot – a single shot (camera framing/movement, what we see)
- dialogue – character spoken lines
- voiceover – VO narration (storytime, commercials, explainers)
- onscreen_text – titles, captions, supers, lower
- transition – cut/fade/match cut, stinger, wipe, jump cut

Production blocks:
- location – location definition (set notes, props, lighting)

*/

export const blockTypeList = [
    "title", 
    "logline", 
    "segment", 
    "segmentSummary", 
    "scene"
] as const;

// export const BlockSchema = z.object({
//     id: z.string().describe("Unique identifier for the block. This will be construct by combining the block type and current order of the block in the array"),
//     parentId: z.string().describe("The id of the parent block that contains this block. This will be empty if the block is a root block."),
//     content: z.string().describe("Content of the block"),
//     type: z.enum(["title", "logline", "segment", "scene", "summary"]).describe("Type of the block"),
// })

export const BlockSchema = z.object({
    id: z.string().describe("Unique identifier for the block. Constructed by combining the block type and current order (e.g., 'segment_1', 'scene_1_2')"),
    parentId: z.string().describe("The id of the parent block. Empty string if root block."),
    content: z.string().describe("Content of the block"),
    type: z.enum(blockTypeList).describe("Type of the block"),
});

export const PlanBlockSchema = z.object({
    id: z.string().describe("Unique identifier for the planned block"),
    type: z.enum(blockTypeList).describe("Type of block to write"),
    parentId: z.string().describe("Parent block id. Empty for root blocks."),
    // order: z.number().describe("Order within parent"),
    content: z.string().describe("Brief description of what this block should contain. In case of segment, it should be a very concise title of the segment."),
});

export const PlanSchema = z.object({
    title: z.string().describe("Working title for the script"),
    logline: z.string().describe("One-sentence premise"),
    structure: z.array(PlanBlockSchema).describe("Ordered list of blocks to write"),
});

export const ReviewSchema = z.object({
    approved: z.boolean().describe("Whether the content passes review"),
    score: z.number().min(1).max(10).describe("Quality score 1-10"),
    issues: z.array(z.object({
        severity: z.enum(["critical", "major", "minor"]).describe("Severity level"),
        description: z.string().describe("What the issue is"),
        suggestion: z.string().describe("How to fix it"),
        affectedContent: z.string().describe("Quote of the problematic text"),
    })).describe("List of issues found"),
    overallFeedback: z.string().describe("Summary feedback for the writer"),
});

export const StatusEventSchema = z.object({
    type: z.enum(["planning", "writing", "reviewing", "revision", "complete", "error"]),
    blockId: z.string().optional(),
    iteration: z.number().optional(),
    message: z.string(),
});

export const CorrectScriptSchema = z.object({
    id: z.string().describe("Unique identifier for the part. The same id that will be sent from the user"),
    content: z.string().describe("New corrected content of the part"),
})
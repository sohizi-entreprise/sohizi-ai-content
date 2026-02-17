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
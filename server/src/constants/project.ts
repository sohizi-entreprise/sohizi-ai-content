export const projectFormats = [
    "storytime",
    "explainer",
    "documentary",
    "presenter",
] as const

export const projectAudiences = [
    "general",
    "kids",
    "teens",
    "adult",
] as const

export const projectStatuses = [
    "DRAFT",
    "CONCEPT_GENERATION_IN_PROGRESS",
    "CONCEPT_GENERATION_FAILED",
    "CONCEPT_GENERATION_COMPLETED",
    "OUTLINE_GENERATION_IN_PROGRESS",
    "OUTLINE_GENERATION_FAILED",
    "CONCEPT_GENERATION_ABORTED",
    "OUTLINE_GENERATION_COMPLETED",
    "SYNOPSIS_GENERATION_IN_PROGRESS",
    "SYNOPSIS_GENERATION_FAILED",
    "SYNOPSIS_GENERATION_COMPLETED",
    "WORLD_BIBLE_GENERATION_IN_PROGRESS",
    "WORLD_BIBLE_GENERATION_FAILED",
    "WORLD_BIBLE_GENERATION_COMPLETED",
    "CHARACTER_BIBLE_GENERATION_IN_PROGRESS",
    "CHARACTER_BIBLE_GENERATION_FAILED",
    "CHARACTER_BIBLE_GENERATION_COMPLETED",
    "SCRIPT_GENERATION_IN_PROGRESS",
    "SCRIPT_GENERATION_FAILED",
    "SCRIPT_GENERATION_COMPLETED",
    "SHOTS_GENERATION_IN_PROGRESS",
    "SHOTS_GENERATION_FAILED",
    "SHOTS_GENERATION_COMPLETED",
] as const

export type ProjectFormat = (typeof projectFormats)[number]
export type ProjectAudience = (typeof projectAudiences)[number]
export type ProjectStatus = (typeof projectStatuses)[number]
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


export type ProjectFormat = (typeof projectFormats)[number]
export type ProjectAudience = (typeof projectAudiences)[number]
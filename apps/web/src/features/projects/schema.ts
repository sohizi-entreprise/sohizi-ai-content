import { z } from "zod"

export const projectBriefSchema = z.object({
  format: z.string(),
  durationMin: z.string(),
  storyIdea: z.string(),
})

const labelValueSchema = z.object({
  label: z.string(),
  value: z.string(),
})

export const additionalSettingsSchema = z.object({
  genre: labelValueSchema.nullable(),
  tone: labelValueSchema.nullable(),
  targetAudience: labelValueSchema
    .nullable()
    .default({ label: "Target audience", value: "general" }),
  primaryPlatform: labelValueSchema.nullable(),
  outlineStructure: labelValueSchema.nullable(),
  narrativeStyle: labelValueSchema.nullable(),
  videoAspectRatio: labelValueSchema
    .nullable()
    .default({ label: "Video aspect ratio", value: "16:9" }),
  characterStyle: labelValueSchema.nullable(),
})

export const createProjectSchema = z.object({
  brief: projectBriefSchema,
  modelId: z.string().nullable(),
  additionalSettings: additionalSettingsSchema,
})

export const createTemplateSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(150, "Name must be less than 150 characters"),
})

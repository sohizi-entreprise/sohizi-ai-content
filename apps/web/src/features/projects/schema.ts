import { z } from "zod"

const titleSchema = z
  .string()
  .min(3, "Title must be at least 3 characters")
  .max(150, "Title must be less than 150 characters")

export const presetSelectionSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
})

export const createInputProjectSchema = z.object({
  title: titleSchema,
  brief: z.string().trim().optional(),
  presets: z.array(presetSelectionSchema),
  commandId: z.string().min(1).nullable().optional(),
  modelId: z.string().min(1).nullable().optional(),
})

export const createBlankProjectSchema = z.object({
  title: titleSchema,
})

export const createProjectSchema = z.union([
  createInputProjectSchema,
  createBlankProjectSchema,
])

export const renameProjectSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be at most 100 characters"),
})

export const createTemplateSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(150, "Name must be less than 150 characters"),
})

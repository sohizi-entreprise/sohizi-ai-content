import { z } from "zod"
import { modelPreferenceKeys } from "@/catalog/preferences"

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

export const createTemplateSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(150, "Name must be less than 150 characters"),
})

export const updateProjectSchema = z.object({
  title: z.string().min(1, "Title is required"),
})
export const deleteProjectSchema = z.object({
  id: z.uuid("Invalid project id"),
  title: z.string().min(1, "Title is required"),
})

export const modelPreferenceKeySchema = z.enum(modelPreferenceKeys)

export const modelPreferenceParametersSchema = z
  .record(z.string(), z.union([z.string().min(1), z.number()]))
  .optional()
  .default({})

export const updateModelPreferenceSchema = z.object({
  key: modelPreferenceKeySchema,
  modelId: z.string().min(1, "Model ID is required"),
  parameters: modelPreferenceParametersSchema,
})

export const estimateModelPreferenceSchema = z.object({
  key: modelPreferenceKeySchema,
  modelId: z.string().min(1, "Model ID is required"),
  parameters: modelPreferenceParametersSchema,
})

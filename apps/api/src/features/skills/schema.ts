import { z } from "zod"

export const skillStatusSchema = z.enum(["draft", "published"])
export const skillVisibilitySchema = z.enum(["public", "private"])

export const createSkillSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  instructions: z.string().trim().min(1),
  status: skillStatusSchema.optional().default("draft"),
  visibility: skillVisibilitySchema.optional().default("private"),
  categoryIds: z.array(z.uuid()).optional().default([]),
})

export const updateSkillSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().min(1).optional(),
  instructions: z.string().trim().min(1).optional(),
  status: skillStatusSchema.optional(),
  visibility: skillVisibilitySchema.optional(),
  categoryIds: z.array(z.uuid()).optional(),
})

export const replaceSkillCategoriesSchema = z.object({
  categoryIds: z.array(z.uuid()),
})

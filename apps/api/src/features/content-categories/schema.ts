import { z } from 'zod'

export const categoryTypeSchema = z.enum([
  'genre',
  'format',
  'audience',
  'platform',
])

export const createContentCategorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  type: categoryTypeSchema,
  description: z.string().trim().nullable().optional(),
  displayPriority: z.number().int().optional().default(0),
})

export const updateContentCategorySchema = createContentCategorySchema.partial()

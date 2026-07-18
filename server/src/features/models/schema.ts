import { z } from 'zod'

export const pricingTierSchema = z.object({
  up_to: z.number().nullable(),
  rate: z.number(),
})

export const tokenPricingSchema = z.object({
  currency: z.literal('USD'),
  unit: z.literal('per_1m_tokens'),
  basis: z.enum(['request_tokens', 'billable_tokens']).optional(),
  input: z.array(pricingTierSchema),
  output: z.array(pricingTierSchema),
  cached_input: z.array(pricingTierSchema).optional(),
})

export const modelOptionChoiceSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
})

export const createModelSchema = z.object({
  id: z.string().min(1).max(50),
  provider: z.string().min(1).max(50),
  name: z.string().min(1).max(50),
  apiName: z.string().min(1).max(50),
  pricing: tokenPricingSchema.nullable().optional(),
  enabled: z.boolean().optional(),
  categoryNames: z.array(z.string().min(1)).default([]),
})

export const updateModelSchema = z.object({
  provider: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(50).optional(),
  apiName: z.string().min(1).max(50).optional(),
  pricing: tokenPricingSchema.nullable().optional(),
  enabled: z.boolean().optional(),
  categoryNames: z.array(z.string().min(1)).optional(),
})

export const replaceCategoriesSchema = z.object({
  categoryNames: z.array(z.string().min(1)),
})

export const createOptionSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  options: z.array(modelOptionChoiceSchema).min(1),
  default: z.string().max(100).nullable().optional(),
  active: z.boolean().optional(),
  provider: z.string().min(1).max(50).optional(),
  modelIds: z.array(z.string().min(1)).default([]),
})

export const updateOptionSchema = z.object({
  key: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  options: z.array(modelOptionChoiceSchema).min(1).optional(),
  default: z.string().max(100).nullable().optional(),
  active: z.boolean().optional(),
  provider: z.string().min(1).max(50).optional(),
  modelIds: z.array(z.string().min(1)).optional(),
})

export const replaceOptionModelsSchema = z.object({
  modelIds: z.array(z.string().min(1)),
})

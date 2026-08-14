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

export const modelParameterTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'array<string>',
  'array<number>',
])

export const modelParameterUiComponentSchema = z.enum(['select', 'slider', 'uploader'])

export const modelParameterConstraintSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  fileType: z.enum(['image', 'video', 'audio']).optional(),
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

export const createParameterSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  type: modelParameterTypeSchema,
  description: z.string().nullable().optional(),
  xUiComponent: modelParameterUiComponentSchema.nullable().optional(),
})

export const updateParameterSchema = z.object({
  key: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  type: modelParameterTypeSchema.optional(),
  description: z.string().nullable().optional(),
  xUiComponent: modelParameterUiComponentSchema.nullable().optional(),
})

export const modelParameterBindingSchema = z.object({
  parameterId: z.uuid(),
  providerParamName: z.string().max(100).nullable().optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  constraints: modelParameterConstraintSchema.nullable().optional(),
  enum: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const replaceModelParametersSchema = z.array(modelParameterBindingSchema)

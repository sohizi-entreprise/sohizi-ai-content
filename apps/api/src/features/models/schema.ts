import { z } from "zod"

export const modelBasePricingSchema = z.discriminatedUnion("unit", [
  z.object({
    unit: z.literal("per_1m_tokens"),
    input: z.number().min(0),
    output: z.number().min(0),
    cached_input: z.number().min(0).optional(),
  }),
  z.object({
    unit: z.literal("per_inference"),
    rate: z.number().min(0),
  }),
])

export const modelParameterTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "array<string>",
  "array<number>",
])

export const modelParameterUiComponentSchema = z.enum([
  "select",
  "slider",
  "uploader",
])

export const modelParameterConstraintSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  fileType: z.enum(["image", "video", "audio"]).optional(),
})

export const createModelSchema = z.object({
  id: z.string().min(1).max(50),
  provider: z.string().min(1).max(50),
  name: z.string().min(1).max(50),
  description: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().optional(),
  pricing: modelBasePricingSchema.nullable().optional(),
  categoryNames: z.array(z.string().min(1)).default([]),
})

export const updateModelSchema = z.object({
  provider: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().optional(),
  pricing: modelBasePricingSchema.nullable().optional(),
  categoryNames: z.array(z.string().min(1)).optional(),
})

export const replaceCategoriesSchema = z.object({
  categoryNames: z.array(z.string().min(1)),
})

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Name must be lowercase kebab-case"),
  description: z.string().trim().max(1000).optional().default(""),
})

export const parameterOptionInputSchema = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().min(1),
  description: z.string().nullable().optional(),
})

export const createParameterSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  type: modelParameterTypeSchema,
  description: z.string().nullable().optional(),
  xUiComponent: modelParameterUiComponentSchema.nullable().optional(),
  options: z.array(parameterOptionInputSchema).optional(),
})

export const updateParameterSchema = z.object({
  key: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  type: modelParameterTypeSchema.optional(),
  description: z.string().nullable().optional(),
  xUiComponent: modelParameterUiComponentSchema.nullable().optional(),
})

export const createParameterOptionSchema = parameterOptionInputSchema

export const updateParameterOptionSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  value: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

export const upsertVendorOptionMapSchema = z.object({
  vendorOptionValue: z.string().min(1),
})

export const upsertVendorParameterMapSchema = z.object({
  vendorParamName: z.string().max(100).nullable().optional(),
  vendorDefaultValue: z.string().nullable().optional(),
})

export const vendorNameSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Name must be a lowercase kebab-case slug",
  )

export const vendorKindSchema = z.enum(["media", "llm"])

export const vendorRateLimitSchema = z.object({
  rpm: z.number().int().min(1),
  burst: z.number().int().min(1).optional(),
  maxConcurrency: z.number().int().min(1),
})

export const vendorCircuitConfigSchema = z.object({
  cooldownMs: z.number().int().min(0),
  probeTtlMs: z.number().int().min(1),
})

export const createVendorSchema = z.object({
  name: vendorNameSlugSchema,
  kind: vendorKindSchema.optional(),
  enabled: z.boolean().optional(),
  rateLimit: vendorRateLimitSchema.optional(),
  circuitConfig: vendorCircuitConfigSchema.nullable().optional(),
})

export const updateVendorSchema = z.object({
  name: vendorNameSlugSchema.optional(),
  kind: vendorKindSchema.optional(),
  enabled: z.boolean().optional(),
  rateLimit: vendorRateLimitSchema.optional(),
  circuitConfig: vendorCircuitConfigSchema.nullable().optional(),
})

export const createModelVendorBindingSchema = z.object({
  vendorId: z.uuid(),
  apiName: z.string().min(1).max(50),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
})

export const updateModelVendorBindingSchema = z.object({
  apiName: z.string().min(1).max(50).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
})

export const modelParameterBindingSchema = z.object({
  parameterId: z.uuid(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  constraints: modelParameterConstraintSchema.nullable().optional(),
  options: z
    .array(
      z.object({
        optionId: z.uuid(),
        priceMultiplier: z.number().min(0).nullable().optional(),
      }),
    )
    .optional(),
  sortOrder: z.number().int().optional(),
})

export const replaceModelParametersSchema = z.array(modelParameterBindingSchema)

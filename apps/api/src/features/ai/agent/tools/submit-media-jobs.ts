import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { failure, success } from "./utils"
import { getErrorMessage } from "@/utils/get-error-message"
import {
  getModelSchema,
  listGenerationModels,
} from "@/features/media-engine/repo"

type ModelSchema = Awaited<ReturnType<typeof getModelSchema>>

const modelCapabilities = [
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "video-to-video",
] as const

const listModelsSchema = z.object({
  type: z
    .enum(modelCapabilities)
    .describe("The type of media generation request"),
})

const getModelSchemaSchema = z.object({
  modelId: z.string().describe("The ID of the model to get the schema for"),
})

const submitRequestSchema = z.object({
  modelId: z.string().describe("The model ID to use for the generation"),
  prompt: z.string().min(1).describe("The prompt to generate the media"),
  parameters: z
    .record(z.string(), z.unknown())
    .describe(
      "The parameters to use for the generation based on the model schema",
    ),
})

export type SubmitRequestInput = z.infer<typeof submitRequestSchema>

export const listModelsTool = buildBaseTool({
  name: "listModels",
  description:
    "List the models available for asset generation for the given media type",
  inputSchema: listModelsSchema,
  execute: async (input) => {
    try {
      const models = await listGenerationModels(input.type)
      if (models.length === 0) {
        return success(
          "No models found for the given media type. No need to continue if no models are available for the given media type.",
        )
      }
      return success(JSON.stringify(models))
    } catch (error) {
      const errorMsg = getErrorMessage(
        error,
        "An error occurred while listing models",
      )
      return failure(errorMsg)
    }
  },
})

export const getModelSchemaTool = buildBaseTool({
  name: "getModelSchema",
  description: "Get the schema for the given model ID",
  inputSchema: getModelSchemaSchema,
  execute: async (input, { artifacts }) => {
    try {
      const schema = await getModelSchema(input.modelId)
      artifacts.set(`schema-${input.modelId}`, schema)
      return success(JSON.stringify(schema))
    } catch (error) {
      const errorMsg = getErrorMessage(
        error,
        "An error occurred while getting the model schema",
      )
      return failure(errorMsg)
    }
  },
})

export const submitRequestTool = buildBaseTool({
  name: "submitRequest",
  description: "Submit the request to the model",
  inputSchema: submitRequestSchema,
  execute: async (input, { state, artifacts }) => {
    try {
      let schema = artifacts.get(`schema-${input.modelId}`) as
        ModelSchema | undefined
      if (!schema) {
        schema = await getModelSchema(input.modelId)
        artifacts.set(`schema-${input.modelId}`, schema)
      }

      const validation = validateInput(schema, input.parameters)
      if (!validation.isValid) {
        return failure(
          `Validation failed. ${validation.errorMsg} Fix the parameters and call submitRequest again.`,
        )
      }

      artifacts.set("submitRequest", { status: "ready", input })
      state.finishRun()
      return success("Request submitted successfully")
    } catch (error) {
      const errorMsg = getErrorMessage(
        error,
        "An error occurred while submitting the request",
      )
      return failure(errorMsg)
    }
  },
})

export const cancelRequestTool = buildBaseTool({
  name: "cancelRequest",
  description:
    "Call this function whenever you cannot proceed with the request due to any reason",
  inputSchema: z.object({
    message: z
      .string()
      .describe(
        "The message to the user explaining why you cannot proceed with the request",
      ),
  }),
  execute: async (input, { artifacts }) => {
    artifacts.set("submitRequest", {
      status: "cancelled",
      reason: input.message,
    })
    return success("Request cancelled successfully")
  },
})

function isOmitted(value: unknown): boolean {
  return value === undefined || value === null || value === ""
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (
      !trimmed ||
      !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)
    ) {
      return null
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseArrayValue(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value !== "string") return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function validateInput(
  schema: ModelSchema,
  inputParameters: Record<string, unknown>,
) {
  const errors: string[] = []

  for (const parameter of schema) {
    const value = inputParameters[parameter.key]
    const constraint = parameter.constraints ?? {}

    if (isOmitted(value)) {
      if (parameter.required) {
        errors.push(
          `This field '${parameter.key}' is required. Please provide a value for this field.`,
        )
      }
      continue
    }

    if (parameter.type === "number") {
      const numberValue = parseNumberValue(value)
      if (numberValue === null) {
        errors.push(`This field '${parameter.key}' must be a number.`)
        continue
      }
      if (constraint.min != null && numberValue < constraint.min) {
        errors.push(
          `This field '${parameter.key}' must be at least ${constraint.min}.`,
        )
      }
      if (constraint.max != null && numberValue > constraint.max) {
        errors.push(
          `This field '${parameter.key}' must be at most ${constraint.max}.`,
        )
      }
      if (constraint.step != null && constraint.step > 0) {
        const base = constraint.min ?? 0
        const steps = (numberValue - base) / constraint.step
        if (
          !Number.isFinite(steps) ||
          Math.abs(steps - Math.round(steps)) > 1e-8
        ) {
          errors.push(
            `This field '${parameter.key}' must be a multiple of ${constraint.step}.`,
          )
        }
      }
      continue
    }

    if (parameter.type === "boolean") {
      if (typeof value !== "boolean") {
        errors.push(`This field '${parameter.key}' must be a boolean.`)
      }
      continue
    }

    if (parameter.type === "string") {
      if (typeof value !== "string") {
        errors.push(`This field '${parameter.key}' must be a string.`)
        continue
      }
      if (parameter.options.length > 0 && !parameter.options.includes(value)) {
        errors.push(
          `This field '${parameter.key}' must be one of: ${parameter.options.join(", ")}.`,
        )
      }
      continue
    }

    if (
      parameter.type === "array<string>" ||
      parameter.type === "array<number>"
    ) {
      const parsed = parseArrayValue(value)
      if (!parsed) {
        errors.push(`This field '${parameter.key}' must be an array.`)
        continue
      }
      if (parameter.required && parsed.length === 0) {
        errors.push(
          `This field '${parameter.key}' is required. Please provide a value for this field.`,
        )
      }
      if (constraint.min != null && parsed.length < constraint.min) {
        errors.push(
          `This field '${parameter.key}' must contain at least ${constraint.min} item${constraint.min === 1 ? "" : "s"}.`,
        )
      }
      if (constraint.max != null && parsed.length > constraint.max) {
        errors.push(
          `This field '${parameter.key}' must contain at most ${constraint.max} item${constraint.max === 1 ? "" : "s"}.`,
        )
      }
      if (parameter.type === "array<string>") {
        if (parsed.some((item) => typeof item !== "string")) {
          errors.push(
            `This field '${parameter.key}' must be an array of strings.`,
          )
        } else if (parameter.options.length > 0) {
          const allowed = new Set(parameter.options)
          const hasInvalid = parsed.some(
            (item) => typeof item === "string" && !allowed.has(item),
          )
          if (hasInvalid) {
            errors.push(
              `This field '${parameter.key}' contains invalid values. Allowed: ${parameter.options.join(", ")}.`,
            )
          }
        }
      } else if (parsed.some((item) => parseNumberValue(item) === null)) {
        errors.push(
          `This field '${parameter.key}' must be an array of numbers.`,
        )
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false as const, errorMsg: errors.join(" ") }
  }
  return { isValid: true as const, errorMsg: null }
}

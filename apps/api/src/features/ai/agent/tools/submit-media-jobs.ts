import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { failure, success } from "./utils"
import { getErrorMessage } from "@/utils/get-error-message"
import {
  getModelSchema,
  listGenerationModels,
} from "@/features/media-engine/repo"
import { validateInput } from "./validate-model-params"

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

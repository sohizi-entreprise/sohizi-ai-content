import { NotFound } from "@/features/error"
import * as repo from "./repo"

export const listLlmModels = async (categories: string[]) => {
  return repo.listEnabledModelsByCategories(categories)
}

export const listModelParameters = async (modelId: string) => {
  const result = await repo.listModelParameterBindings(modelId)
  if (!result.found) {
    throw new NotFound("Model not found")
  }
  return result.bindings
}

export const getModelById = repo.getModelById

import { NotFound } from '@/features/error'
import * as repo from './repo'

export const listLlmModels = async (categories: string[]) => {
  return repo.listEnabledModelsByCategories(categories)
}

export const listModelParameters = async (modelId: string) => {
  const model = await repo.getModelById(modelId)
  if (!model) {
    throw new NotFound('Model not found')
  }
  return repo.listModelParameterBindings(model.id)
}

export const getModelById = repo.getModelById

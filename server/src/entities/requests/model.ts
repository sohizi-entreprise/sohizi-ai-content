import { t } from "elysia"

export const CreateGenerationRequestDTO = t.Object({
  projectId: t.String(),
  type: t.String(),
  prompt: t.Union([t.String(), t.Null()]),
})

export const GenerationRequestResponseDTO = t.Object({
  id: t.String(),
  projectId: t.String(),
  type: t.String(),
  prompt: t.Union([t.String(), t.Null()]),
  status: t.String(),
  error: t.Union([t.String(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

export const updateGenerationRequestDTO = t.Object({
  status: t.String(),
  error: t.Union([t.String(), t.Null()]),
})

export type GenerationRequest = typeof CreateGenerationRequestDTO.static
export type GenerationRequestResponse = typeof GenerationRequestResponseDTO.static
export type UpdateGenerationRequest = typeof updateGenerationRequestDTO.static




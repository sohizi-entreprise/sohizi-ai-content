import { t } from "elysia"
import { generationRequestStatusEnum, generationRequestTypeEnum } from "@/db/schema/base"

export const CreateGenerationRequestDTO = t.Object({
  projectId: t.String(),
  type: t.UnionEnum(generationRequestTypeEnum.enumValues),
  prompt: t.Union([t.String(), t.Null()]),
})

export const GenerationRequestResponseDTO = t.Object({
  id: t.String(),
  projectId: t.String(),
  type: t.UnionEnum(generationRequestTypeEnum.enumValues),
  prompt: t.Union([t.String(), t.Null()]),
  status: t.UnionEnum(generationRequestStatusEnum.enumValues),
  error: t.Union([t.String(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

export const updateGenerationRequestDTO = t.Object({
  status: t.UnionEnum(generationRequestStatusEnum.enumValues),
  error: t.Union([t.String(), t.Null()]),
})

export type GenerationRequest = typeof CreateGenerationRequestDTO.static
export type GenerationRequestResponse = typeof GenerationRequestResponseDTO.static
export type UpdateGenerationRequest = typeof updateGenerationRequestDTO.static




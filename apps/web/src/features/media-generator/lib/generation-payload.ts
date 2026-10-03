import { getAgentMediaType } from "../constants"
import { coerceParameterSettings } from "./parameter-assets"
import type { AssetRequest } from "../requests"
import type { GenerationSubtype, GenerationType } from "../types"
import type { ModelParameterBinding } from "@/features/admin/types"

export function buildGenerationPayload(input: {
  selectedModelId: string | null
  parameterValues: Record<string, string>
  parameters: Array<ModelParameterBinding>
  generationType: GenerationType
  generationSubtype: GenerationSubtype | null
}): AssetRequest {
  return {
    model: input.selectedModelId ?? "",
    settings: coerceParameterSettings(input.parameterValues, input.parameters),
    context: {
      model: input.selectedModelId,
      mediaType: getAgentMediaType(
        input.generationType,
        input.generationSubtype,
      ),
      generationType: input.generationType,
      subtype: input.generationSubtype,
      referencedFiles: [],
    },
  }
}

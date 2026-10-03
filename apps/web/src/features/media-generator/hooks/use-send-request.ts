import { useMutation } from "@tanstack/react-query"
import { startGenerationMutationOptions } from "../query-mutations"
import { buildGenerationPayload } from "../lib/generation-payload"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import type { ModelParameterBinding } from "@/features/admin/types"

export const useSendRequest = (projectId: string) => {
  const { mutate: handleSendRequest, isPending } = useMutation(
    startGenerationMutationOptions(projectId),
  )

  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore(
    (state) => state.generationSubtype,
  )
  const selectedModelId = useMediaGeneratorStore(
    (state) => state.selectedModelId,
  )
  const parameterValues = useMediaGeneratorStore(
    (state) => state.parameterValues,
  )
  const updateParameterValue = useMediaGeneratorStore(
    (state) => state.updateParameterValue,
  )

  const appendActiveGenerationRequest = useMediaGeneratorStore(
    (state) => state.appendActiveGenerationRequest,
  )

  const sendRequest = (parameters: Array<ModelParameterBinding> = []) => {
    const payload = buildGenerationPayload({
      selectedModelId,
      parameterValues,
      parameters,
      generationType,
      generationSubtype,
    })

    handleSendRequest(payload, {
      onSuccess: (data) => {
        appendActiveGenerationRequest({ requestId: data.id })
        updateParameterValue("prompt", "")
      },
      onError: (error) => {
        console.error(error)
      },
    })
  }

  return { sendRequest, isPending }
}

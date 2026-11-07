import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { startGenerationMutationOptions } from "../query-mutations"
import { buildGenerationPayload } from "../lib/generation-payload"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import type { ModelParameterBinding } from "@/features/admin/types"
import { classifyRunError } from "@/features/chat/lib/run-error"
import { getErrorMessage } from "@/lib/errors"

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
        const rawMessage = getErrorMessage(error, "Failed to start generation")
        const classified = classifyRunError(rawMessage)
        toast.error(
          classified.kind === "billing" ? classified.message : rawMessage,
        )
      },
    })
  }

  return { sendRequest, isPending }
}

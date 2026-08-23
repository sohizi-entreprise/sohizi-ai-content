import { useMutation } from "@tanstack/react-query"
import type { ModelParameterBinding } from "@/features/admin/types"
import { startGenerationMutationOptions } from "../query-mutations"
import { AssetRequest } from "../requests"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { cleanMediaType } from "@/utils/clean-mediaType"
import { getAgentMediaType, showsVoiceSelector } from "../constants"
import { coerceParameterSettings } from "../lib/parameter-assets"


export const useSendRequest = (projectId: string) => {
  const { mutate: handleSendRequest, isPending } = useMutation(startGenerationMutationOptions(projectId))

  const prompt = useMediaGeneratorStore((state) => state.prompt)
  const attachments = useMediaGeneratorStore((state) => state.attachments)
  const promptSettings = useMediaGeneratorStore((state) => state.promptSettings)
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore((state) => state.generationSubtype)
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelId)
  const parameterValues = useMediaGeneratorStore((state) => state.parameterValues)
  const runMode = useMediaGeneratorStore((state) => state.runMode)
  const clearChatInput = useMediaGeneratorStore((state) => state.clearChatInput)

  const appendActiveGenerationRequest = useMediaGeneratorStore((state) => state.appendActiveGenerationRequest)

  const uploadedAttachments = attachments.filter((attachment) => attachment.status === 'uploaded')

  const context = {
    model: selectedModelId,
    mediaType: getAgentMediaType(generationType, generationSubtype),
    generationType,
    subtype: generationSubtype,
    referencedFiles: uploadedAttachments.map((attachment) => ({
      type: attachment.type,
      url: attachment.url,
      mediaType: cleanMediaType(attachment.type, attachment.url),
    })),
    ...(showsVoiceSelector(generationType, generationSubtype)
          ? { voice: promptSettings.audio.voice }
          : {}),
  }

  const sendRequest = async (parameters: ModelParameterBinding[] = []) => {
    const payload: AssetRequest = {
      model: selectedModelId ?? '',
      prompt,
      settings: coerceParameterSettings(parameterValues, parameters),
      context,
      runMode,
    }

    handleSendRequest(payload, {
        onSuccess: (data) => {
            appendActiveGenerationRequest({requestId: data.id})
            clearChatInput()
        },
        onError: (error) => {
            console.error(error)
        }
    })
  }

  const disableButton = !prompt || isPending

  return { sendRequest, isPending, disableButton }
}

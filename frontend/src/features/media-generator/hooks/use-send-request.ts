import { useMutation } from "@tanstack/react-query"
import { startGenerationMutationOptions } from "../query-mutations"
import { AssetRequest } from "../requests"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { ImagePart, MsgTextPart, FilePart } from "@/features/chat/types"
import { cleanMediaType } from "@/utils/clean-mediaType"
import { getAgentMediaType, showsVoiceSelector } from "../constants"


export const useSendRequest = (projectId: string) => {
  const { mutate: handleSendRequest, isPending } = useMutation(startGenerationMutationOptions(projectId))

  const prompt = useMediaGeneratorStore((state) => state.prompt)
  const attachments = useMediaGeneratorStore((state) => state.attachments)
  const promptSettings = useMediaGeneratorStore((state) => state.promptSettings)
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore((state) => state.generationSubtype)
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelId)
  const parameterValues = useMediaGeneratorStore((state) => state.parameterValues)
  const clearChatInput = useMediaGeneratorStore((state) => state.clearChatInput)

  const appendActiveGenerationRequest = useMediaGeneratorStore((state) => state.appendActiveGenerationRequest)

  const uploadedAttachments = attachments.filter((attachment) => attachment.status === 'uploaded')

  const content: (MsgTextPart | ImagePart | FilePart)[] = [
    {
      type: 'text',
      text: prompt,
    },
    ...uploadedAttachments.map((attachment) => ({
      type: 'file' as const,
      data: new URL(attachment.url),
      mediaType: cleanMediaType(attachment.type, attachment.url),
    })),
  ]

  const payload: AssetRequest= {
    userPrompt: {
        role: 'user',
        content
    },
    settings: {
        mediaType: getAgentMediaType(generationType, generationSubtype),
        generationType,
        subtype: generationSubtype,
        model: selectedModelId,
        referencedFiles: uploadedAttachments.map((attachment) => ({
          type: attachment.type,
          url: attachment.url,
        })),
        ...(showsVoiceSelector(generationType, generationSubtype)
          ? { voice: promptSettings.audio.voice }
          : {}),
        ...parameterValues,
    }
  }

  const sendRequest = async () => {
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

import { useMutation } from "@tanstack/react-query"
import { startGenerationMutationOptions } from "../query-mutations"
import { AssetRequest } from "../requests"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { ImagePart, MsgTextPart, FilePart } from "@/features/chat/types"
import { cleanMediaType } from "@/utils/clean-mediaType"


export const useSendRequest = (projectId: string) => {
  const { mutate: handleSendRequest, isPending } = useMutation(startGenerationMutationOptions(projectId))

  const prompt = useMediaGeneratorStore((state) => state.prompt)
  const attachments = useMediaGeneratorStore((state) => state.attachments)
  const settings = useMediaGeneratorStore((state) => state.settings)
  const mediaType = useMediaGeneratorStore((state) => state.mediaType)
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelIds[mediaType])
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

  const payloadSettings = Object.fromEntries(
    settings[mediaType]?.map((item) => [item.key, item.currentValue]) ?? [],
  )
  
  const payload: AssetRequest= {
    userPrompt: {
        role: 'user',
        content
    },
    settings: {
        mediaType: mediaType,
        modelId: selectedModelId ?? undefined,
        referencedFiles: uploadedAttachments.map((attachment) => ({
          type: attachment.type,
          url: attachment.url,
        })),
        ...payloadSettings,
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
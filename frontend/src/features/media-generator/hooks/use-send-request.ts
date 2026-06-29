import { useMutation } from "@tanstack/react-query"
import { startGenerationMutationOptions } from "../query-mutations"
import { AssetRequest } from "../requests"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { ImagePart, MsgTextPart, FilePart } from "@/features/chat/types"


export const useSendRequest = (projectId: string) => {
  const { mutate: handleSendRequest, isPending } = useMutation(startGenerationMutationOptions(projectId))

  const prompt = useMediaGeneratorStore((state) => state.prompt)
  const attachments = useMediaGeneratorStore((state) => state.attachments)
  const settings = useMediaGeneratorStore((state) => state.settings)
  const mediaType = useMediaGeneratorStore((state) => state.mediaType)

  const appendActiveGenerationRequest = useMediaGeneratorStore((state) => state.appendActiveGenerationRequest)

  const content: (MsgTextPart | ImagePart | FilePart)[] = [
    {
      type: 'text',
      text: prompt,
    },
    ...attachments.filter((attachment) => attachment.status === 'uploaded').map((attachment) => ({
      type: 'file' as const,
      data: new URL(attachment.url),
      mediaType: attachment.type,
    })),
  ]
  
  const userPrompt: AssetRequest= {
    userPrompt: {
        role: 'user',
        content
    },
    settings: {
        ...settings,
        mediaType: mediaType,
    }
  }

  const sendRequest = async () => {
    handleSendRequest(userPrompt, {
        onSuccess: (data) => {
            appendActiveGenerationRequest({requestId: data.id})
            // Set query for listing generations
            // Clear the input
            console.log(data)
        },
        onError: (error) => {
            console.error(error)
        }
    })
    
  }

  const disableButton = !prompt || isPending

  return { sendRequest, isPending, disableButton }
}
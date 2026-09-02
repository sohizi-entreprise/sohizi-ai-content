import { useShallow } from "zustand/shallow"
import { useMutation } from "@tanstack/react-query"
import { useChatStore } from "../store/chat-store"
import { submitChatCompletionMutationOptions } from "../query-mutation"
import { buildEditorContext } from "../lib/editor-context"
import type { ChatCompletionRequest, FilePart, ImagePart } from "../types"
import type { AttachedFile } from "@/components/widgets/file-attachments"
import { cleanMediaType } from "@/utils/clean-mediaType"
import { useEditorInputBridge } from "@/features/editor/bridge/use-editor-input-bridge"

export const useSendMessage = (projectId: string) => {
  const clearInput = useChatStore((state) => state.clearInput)
  const modelId = useChatStore((state) => state.model?.id)
  const conversation = useChatStore(
    useShallow((state) => state.activeConversation),
  )
  const attachedFiles = useChatStore(useShallow((state) => state.attachedFiles))
  const userPrompt = useChatStore((state) => state.userPrompt.trim())
  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation,
  )

  const { mutate: sendMessageMutation, isPending } = useMutation(
    submitChatCompletionMutationOptions(projectId),
  )

  const disableSendButton =
    !userPrompt || !modelId || isPending || conversation?.isStreaming
  const loadingState = isPending || conversation?.isStreaming || false
  const conversationId = conversation?.id ?? null

  const sendMessage = () => {
    if (disableSendButton) return

    const payload: ChatCompletionRequest = {
      modelId,
      userPrompt: {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...buildFilesPayload(attachedFiles),
        ],
      },
      conversationId,
      editorContext: buildEditorContext(
        useEditorInputBridge.getState().chatEditor,
      ),
      isNew: conversation?.isNew ?? true,
    }

    sendMessageMutation(payload, {
      onSuccess: (data) => {
        setActiveConversation({
          ...data.conversation,
          isStreaming: true,
          isNew: false,
        })
        clearInput()
      },
    })
  }

  return { sendMessage, loadingState, disableSendButton }
}

function buildFilesPayload(
  attachedFiles: Array<AttachedFile>,
): Array<ImagePart | FilePart> {
  const filtered = attachedFiles.filter((file) => file.status === "uploaded")
  const result: Array<ImagePart | FilePart> = []
  for (const file of filtered) {
    if (file.type.startsWith("image/") || file.type === "image") {
      result.push({
        type: "image",
        image: new URL(file.url),
      })
    } else {
      result.push({
        type: "file",
        data: new URL(file.url),
        mediaType: cleanMediaType(file.type, file.url),
      })
    }
  }
  return result
}

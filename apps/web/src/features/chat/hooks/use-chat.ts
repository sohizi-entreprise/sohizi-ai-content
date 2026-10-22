import { useShallow } from "zustand/shallow"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useChatStore } from "../store/chat-store"
import { resolveReasoningEffort } from "../lib/reasoning-effort"
import {
  cancelChatRunMutationOptions,
  submitChatCompletionMutationOptions,
} from "../query-mutation"
import { buildUserFileParts } from "../lib/attached-files"
import { buildEditorContext } from "../lib/editor-context"
import type { ChatCompletionRequest } from "../types"
import type { ChatStatus } from "ai"
import { useEditorInputBridge } from "@/features/editor/bridge/use-editor-input-bridge"
import { getErrorMessage } from "@/lib/errors"

export const useSendMessage = (projectId: string) => {
  const clearInput = useChatStore((state) => state.clearInput)
  const model = useChatStore((state) => state.model)
  const modelId = model?.id
  const reasoningEffortByModelId = useChatStore(
    (state) => state.reasoningEffortByModelId,
  )
  const conversation = useChatStore(
    useShallow((state) => state.activeConversation),
  )
  const attachedFiles = useChatStore(useShallow((state) => state.attachedFiles))
  const userPrompt = useChatStore((state) => state.userPrompt.trim())
  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation,
  )
  const patchActiveConversation = useChatStore(
    (state) => state.patchActiveConversation,
  )

  const { mutate: sendMessageMutation, isPending } = useMutation(
    submitChatCompletionMutationOptions(projectId),
  )
  const { mutate: cancelRunMutation, isPending: isCancelling } = useMutation(
    cancelChatRunMutationOptions(projectId),
  )

  const isStreaming = conversation?.isStreaming ?? false
  const disableSendButton = !userPrompt || !modelId || isPending || isStreaming
  const loadingState = isPending || isStreaming
  const conversationId = conversation?.id ?? null
  const submitStatus: ChatStatus | undefined = isStreaming
    ? "streaming"
    : isPending
      ? "submitted"
      : undefined

  const sendMessage = () => {
    if (disableSendButton || !modelId) return

    const payload: ChatCompletionRequest = {
      modelId,
      reasoningEffort: resolveReasoningEffort(model, reasoningEffortByModelId),
      userPrompt: {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...buildUserFileParts(attachedFiles),
        ],
      },
      conversationId,
      editorContext: buildEditorContext(
        useEditorInputBridge.getState().chatEditor,
      ),
      isNew: conversation?.isNew ?? true,
    }
    // console.log("payload", payload)
    // return

    sendMessageMutation(payload, {
      onSuccess: (data) => {
        setActiveConversation({
          ...data.conversation,
          isStreaming: true,
          isNew: false,
          activeRunId: data.run.id,
        })
        clearInput()
      },
    })
  }

  const cancelGeneration = () => {
    const runId = conversation?.activeRunId
    if (!conversationId || !runId || isCancelling) return

    cancelRunMutation(
      { conversationId, runId },
      {
        onSuccess: () => {
          patchActiveConversation({
            isStreaming: false,
            activeRunId: null,
          })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to cancel generation"))
        },
      },
    )
  }

  return {
    sendMessage,
    cancelGeneration,
    loadingState,
    disableSendButton,
    isStreaming,
    isCancelling,
    submitStatus,
  }
}


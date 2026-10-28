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
import { classifyRunError } from "../lib/run-error"
import type { ChatCompletionRequest } from "../types"
import type { ChatStatus } from "ai"
import { collectCommandsFromChatEditor } from "@/features/editor/extensions/command-mention"
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
  const markRunCancelled = useChatStore((state) => state.markRunCancelled)
  const unmarkRunCancelled = useChatStore((state) => state.unmarkRunCancelled)

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

    const chatEditor = useEditorInputBridge.getState().chatEditor
    const commands = collectCommandsFromChatEditor(chatEditor)

    const payload: ChatCompletionRequest = {
      modelId,
      reasoningEffort: resolveReasoningEffort(model, reasoningEffortByModelId),
      ...(commands.length > 0 ? { commands } : {}),
      userPrompt: {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...buildUserFileParts(attachedFiles),
        ],
      },
      conversationId,
      editorContext: buildEditorContext(chatEditor),
      isNew: conversation?.isNew ?? true,
    }

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
      onError: (error) => {
        const rawMessage = getErrorMessage(error, "")
        const classified = classifyRunError(rawMessage)
        toast.error(classified.message)
      },
    })
  }

  const cancelGeneration = () => {
    const runId = conversation?.activeRunId
    if (!conversationId || !runId || isCancelling) return

    markRunCancelled(runId)
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
          unmarkRunCancelled(runId)
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

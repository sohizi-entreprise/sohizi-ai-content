import { useCallback } from "react"
import { useChatStore } from "../store/chat-store"
import type {
  EmptyStateCommand,
  EmptyStateSuggestion,
} from "../constants/empty-state-content"
import type { JSONContent } from "@tiptap/core"
import { useEditorInputBridge } from "@/features/editor/bridge/use-editor-input-bridge"

export function buildCommandPromptDoc(
  command: EmptyStateCommand,
  promptPrefix: string,
): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "commandMention",
            attrs: {
              id: command.id,
              name: command.id,
              display: command.display,
            },
          },
          {
            type: "text",
            text: ` ${promptPrefix.trim()}:`,
          },
        ],
      },
      {
        type: "paragraph",
      },
    ],
  }
}

export function useFillChatInput() {
  const chatEditor = useEditorInputBridge((state) => state.chatEditor)
  const setUserPrompt = useChatStore((state) => state.setUserPrompt)

  return useCallback(
    (suggestion: Pick<EmptyStateSuggestion, "command" | "promptPrefix">) => {
      const { command, promptPrefix } = suggestion
      if (chatEditor) {
        chatEditor
          .chain()
          .focus()
          .setContent(buildCommandPromptDoc(command, promptPrefix), {
            emitUpdate: true,
          })
          .focus("end")
          .run()
        return
      }
      setUserPrompt(`/${command.display} ${promptPrefix.trim()}:\n`)
    },
    [chatEditor, setUserPrompt],
  )
}

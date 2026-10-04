import { useEditorStore } from "../stores/editor-store"
import { useEditorInputBridge } from "./use-editor-input-bridge"

export function attachFileToChat(params: {
  file: { name: string; path: string }
  extraText?: string
}): void {
  ensureChatPanelOpen()
  if (useEditorInputBridge.getState().chatEditor) {
    insertFileMention(params)
    return
  }

  // Chat textarea mounts after the panel opens; retry once it is ready.
  window.setTimeout(() => insertFileMention(params), 80)
}

function ensureChatPanelOpen() {
  const { chatOpenByContext, toggleChatPanel } = useEditorStore.getState()
  if (!chatOpenByContext["file-system"]) {
    toggleChatPanel("file-system")
  }
}

function insertFileMention(params: {
  file: { name: string; path: string }
  extraText?: string
}) {
  const { runCommand, chatEditor } = useEditorInputBridge.getState()
  if (!chatEditor) return

  runCommand({
    type: "insertMention",
    mention: {
      displayName: params.file.name,
      path: params.file.path,
    },
  })

  if (params.extraText) {
    chatEditor.chain().insertContent(`${params.extraText} `).run()
  }
}

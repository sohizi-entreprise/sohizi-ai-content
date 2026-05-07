import { useChatStore } from '@/features/chat'
import { Editor } from '@tiptap/core'
import { z } from 'zod'
import { create } from 'zustand'

type EditorInputState = {
    input: HTMLTextAreaElement | HTMLInputElement | null
    editor: Editor | null
}

type EditorInputActions = {
    setInput: (input: HTMLTextAreaElement | HTMLInputElement | null) => void
    setEditor: (editor: Editor) => void
    clearEditor: (editor: Editor) => void
    reset: () => void
    runCommand: (command: EditorInputBridgeCommand) => void
}

const initialState: EditorInputState = {
    input: null,
    editor: null
}


export const useEditorInputBridge = create<EditorInputState & EditorInputActions>()((set, get) => ({
  ...initialState,
  setInput: (input) => set({ input }),
  setEditor: (editor) => set({ editor }),
  clearEditor: (editor) => set({
    editor: editor === get().editor ? null : get().editor
  }),
  reset: () => set(initialState),
  runCommand: (command) => {
    const { input, editor } = get()
    if (!input || !editor) return

    switch (command.type) {
      case 'insertMention': {
        const appendUserPrompt = useChatStore.getState().appendUserPrompt
        const text = ` @[${command.mention.display}](${command.mention.id})`
        appendUserPrompt(text)
        editor
            .chain()
            .setTextSelection(editor.state.selection.to)
            .blur()
            .run()
        input.focus()
        break
      }
    }
  }
}))

const insertMentionCommand = z.object({
    type: z.literal('insertMention'),
    mention: z.object({
        id: z.string(),
        display: z.string(),
    }),
})

const commandSchema = z.discriminatedUnion('type', [insertMentionCommand])

export type EditorInputBridgeCommand = z.infer<typeof commandSchema>
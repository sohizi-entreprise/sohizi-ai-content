import { z } from "zod"
import { create } from "zustand"
import type { Editor } from "@tiptap/core"
import type { AttachedSelection } from "@/features/chat/types"

type EditorInputState = {
  input: HTMLTextAreaElement | HTMLInputElement | null
  editor: Editor | null
  chatEditor: Editor | null
}

type EditorInputActions = {
  setInput: (input: HTMLTextAreaElement | HTMLInputElement | null) => void
  setEditor: (editor: Editor) => void
  clearEditor: (editor: Editor) => void
  setChatEditor: (editor: Editor | null) => void
  reset: () => void
  runCommand: (command: EditorInputBridgeCommand) => void
}

const initialState: EditorInputState = {
  input: null,
  editor: null,
  chatEditor: null,
}

export const useEditorInputBridge = create<
  EditorInputState & EditorInputActions
>()((set, get) => ({
  ...initialState,
  setInput: (input) => set({ input }),
  setEditor: (editor) => set({ editor }),
  clearEditor: (editor) =>
    set({
      editor: editor === get().editor ? null : get().editor,
    }),
  setChatEditor: (chatEditor) => set({ chatEditor }),
  reset: () => set(initialState),
  runCommand: (command) => {
    const { editor, chatEditor } = get()
    if (!chatEditor) return

    const { displayName, fileId, format, lines, selection } = command.mention
    chatEditor
      .chain()
      .focus()
      .insertContent(" ")
      .insertContent({
        type: "fileMention",
        attrs: {
          id: fileId,
          label: displayName,
          format,
          lines: lines ?? null,
          selection: selection ?? null,
        },
      })
      .insertContent(" ")
      .run()
    editor?.chain().setTextSelection(editor.state.selection.to).blur().run()
  },
}))

const attachedSelectionSchema = z.object({
  file: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  selectedText: z.string(),
  textBefore: z.string().optional(),
  textAfter: z.string().optional(),
  isEntireFile: z.boolean(),
}) satisfies z.ZodType<AttachedSelection>

const insertMentionCommand = z.object({
  type: z.literal("insertMention"),
  mention: z.object({
    displayName: z.string(),
    fileId: z.string(),
    format: z.string(),
    lines: z.string().optional(),
    selection: attachedSelectionSchema.optional(),
  }),
})

const commandSchema = z.discriminatedUnion("type", [insertMentionCommand])

export type EditorInputBridgeCommand = z.infer<typeof commandSchema>

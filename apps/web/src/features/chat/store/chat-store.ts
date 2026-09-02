import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { v4 as uuidv4 } from "uuid"
import type { StateCreator } from "zustand"
import type { Conversation, LlmModel, Message } from "../types"
import type { AttachedFile } from "@/components/widgets/file-attachments"

// ============================================================================
// INITIAL STATE
// ============================================================================

type AttachedFileUpdate =
  | Partial<Omit<Extract<AttachedFile, { status: "pending" }>, "id">>
  | Omit<Extract<AttachedFile, { status: "uploaded" }>, "id">
  | Omit<Extract<AttachedFile, { status: "failed" }>, "id">

export type ActiveStreamEntry = {
  messages: Array<Message>
  requestId: string
}

export type StoreConversation = Conversation & {
  isStreaming?: boolean
  isNew?: boolean
}

type ChatState = {
  userPrompt: string
  activeConversation: StoreConversation | null
  model: LlmModel | null
  attachedFiles: Array<AttachedFile>
}

type ChatActions = {
  setUserPrompt: (content: string) => void
  appendUserPrompt: (content: string) => void
  setModel: (model: LlmModel) => void
  setActiveConversation: (conversation: StoreConversation) => void
  patchActiveConversation: (conversation: Partial<StoreConversation>) => void
  clearInput: () => void
  reset: () => void
  init: (projectId: string) => void
  addAttachedFile: (file: AttachedFile) => void
  removeAttachedFile: (id: string) => void
  updateAttachedFile: (id: string, file: AttachedFileUpdate) => void
}

const initialState: ChatState = {
  userPrompt: "",
  activeConversation: null,
  model: null,
  attachedFiles: [],
}

// ============================================================================
// STORE
// ============================================================================

export const useChatStore = create<ChatState & ChatActions>()(
  immer((set) => ({
    ...initialState,
    setUserPrompt: (userPrompt) => set({ userPrompt }),
    appendUserPrompt: (content) =>
      set((state) => ({ userPrompt: state.userPrompt + content })),
    setModel: (model) => set({ model }),
    setActiveConversation: (conversation) =>
      set({ activeConversation: conversation }),
    patchActiveConversation: (conversation) =>
      set((state) => {
        if (state.activeConversation) {
          state.activeConversation = {
            ...state.activeConversation,
            ...conversation,
          }
        }
      }),
    clearInput: () => set({ userPrompt: "", attachedFiles: [] }),
    init: (projectId) => set(createInitialState(projectId)),
    reset: () => set(initialState),

    addAttachedFile: (file) =>
      set((state) => {
        const index = state.attachedFiles.findIndex((f) => f.id === file.id)

        if (index >= 0) {
          state.attachedFiles[index] = file
          return
        }
        state.attachedFiles.push(file)
      }),
    updateAttachedFile: (id, file) =>
      set((state) => {
        const index = state.attachedFiles.findIndex((f) => f.id === id)
        if (index < 0) return

        const currentFile = state.attachedFiles[index]
        state.attachedFiles[index] = { ...currentFile, ...file }
      }),
    removeAttachedFile: (id) =>
      set((state) => {
        state.attachedFiles = state.attachedFiles.filter(
          (file) => file.id !== id,
        )
      }),
  })) as StateCreator<ChatState & ChatActions>,
)

function createInitialState(projectId: string): ChatState {
  return {
    ...initialState,
    activeConversation: {
      id: uuidv4(),
      projectId,
      title: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isNew: true,
      isStreaming: false,
    },
  }
}

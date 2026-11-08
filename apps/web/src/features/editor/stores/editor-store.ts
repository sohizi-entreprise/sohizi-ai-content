import { create } from "zustand"
import { toast } from "sonner"
import { useFileTreeStore } from "./file-tree-store"
import type { EditorTab, FileTreeNode } from "../types"
import { getFileNodeById, getFileNodeByPath } from "@/features/projects/request"
import { toProjectFilePath } from "@/lib/file-tag"

export type ChatChromeContext =
  "file-system" | "video-editor" | "media-generator"

export function getChatChromeContext(pathname: string): ChatChromeContext {
  if (pathname.includes("/video-editor")) return "video-editor"
  if (pathname.includes("/generate")) return "media-generator"
  return "file-system"
}

interface EditorState {
  activeTabId: string | null
  openTabs: Array<EditorTab>
  selectedFileId: string | null
  activityBarItem: string
  sidebarCollapsed: boolean
  savingStatus: Record<string, "saving" | "saved" | "error">
  lastSavedAt: Record<string, string>
  chatOpenByContext: Record<ChatChromeContext, boolean>

  setSavingStatus: (tabId: string, status: "saving" | "saved" | "error") => void
  initLastSavedAt: (tabId: string, updatedAt: string) => void
  openFile: (node: FileTreeNode) => void
  openFileByPath: (
    path: string,
    options?: { ignoreDirectory?: boolean },
  ) => Promise<void>
  openFileById: (
    fileId: string,
    options?: { ignoreDirectory?: boolean },
  ) => Promise<void>
  updateTab: (
    fileId: string,
    patch: { name?: string; path?: string; oldPath?: string },
  ) => void
  closeTab: (tabId: string) => void
  closeAllTabs: () => void
  setActiveTab: (tabId: string) => void
  setActivityBarItem: (item: string) => void
  setSelectedFileId: (id: string | null) => void
  toggleSidebar: () => void
  toggleChatPanel: (context: ChatChromeContext) => void
  activateFocusMode: (context: ChatChromeContext) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeTabId: null,
  openTabs: [],
  selectedFileId: null,
  activityBarItem: "files" as const,
  sidebarCollapsed: false,
  savingStatus: {},
  lastSavedAt: {},
  chatOpenByContext: {
    "file-system": true,
    "video-editor": true,
    "media-generator": true,
  },

  setSavingStatus: (tabId, status) => {
    if (status === "saved") {
      set({
        savingStatus: { ...get().savingStatus, [tabId]: status },
        lastSavedAt: {
          ...get().lastSavedAt,
          [tabId]: new Date().toISOString(),
        },
      })
      return
    }

    set({ savingStatus: { ...get().savingStatus, [tabId]: status } })
  },
  initLastSavedAt: (tabId, updatedAt) => {
    if (get().lastSavedAt[tabId]) return
    set({
      lastSavedAt: { ...get().lastSavedAt, [tabId]: updatedAt },
    })
  },
  openFile: (node) => {
    if (node.directory) return
    const { openTabs } = get()
    const existing = openTabs.find(
      (t) => t.id === node.id || (node.path !== "" && t.path === node.path),
    )
    if (existing) {
      set({
        activeTabId: existing.id,
        selectedFileId: existing.id,
      })
      return
    }
    const newTab: EditorTab = {
      id: node.id,
      name: node.name,
      path: node.path,
      extension: getFileExtension(node.name),
      type: node.type,
      format: node.format,
    }
    set({
      openTabs: [...openTabs, newTab],
      activeTabId: node.id,
      selectedFileId: node.id,
    })
  },

  openFileByPath: async (path, options) => {
    const normalized = toProjectFilePath(path) ?? path.trim()
    if (!normalized) {
      toast.error("Invalid file path")
      return
    }

    const existing = get().openTabs.find((tab) => tab.path === normalized)
    if (existing) {
      set({
        activeTabId: existing.id,
        selectedFileId: existing.id,
      })
      return
    }

    const projectId = useFileTreeStore.getState().projectId
    if (!projectId) {
      toast.error("No project selected")
      return
    }

    try {
      const node = await getFileNodeByPath(projectId, normalized)
      if (node.directory) {
        if (!options?.ignoreDirectory) {
          set({ selectedFileId: node.id })
        }
        return
      }
      get().openFile(node)
    } catch {
      toast.error("File not found")
    }
  },

  openFileById: async (fileId, options) => {
    const existing = get().openTabs.find((tab) => tab.id === fileId)
    if (existing) {
      set({
        activeTabId: existing.id,
        selectedFileId: existing.id,
      })
      return
    }

    const projectId = useFileTreeStore.getState().projectId
    if (!projectId) {
      toast.error("No project selected")
      return
    }

    try {
      const node = await getFileNodeById(projectId, fileId)
      if (node.directory) {
        if (!options?.ignoreDirectory) {
          set({ selectedFileId: node.id })
        }
        return
      }
      get().openFile(node)
    } catch {
      toast.error("File not found")
    }
  },

  updateTab: (fileId, patch) => {
    const { openTabs } = get()
    const current = openTabs.find((tab) => tab.id === fileId)
    const oldPath = patch.oldPath ?? current?.path
    const newPath = patch.path

    set({
      openTabs: openTabs.map((tab) => {
        if (tab.id === fileId) {
          return {
            ...tab,
            ...(patch.name !== undefined
              ? {
                  name: patch.name,
                  extension: getFileExtension(patch.name),
                }
              : {}),
            ...(newPath !== undefined ? { path: newPath } : {}),
          }
        }

        if (
          oldPath &&
          newPath &&
          oldPath !== "" &&
          tab.path.startsWith(`${oldPath}/`)
        ) {
          return {
            ...tab,
            path: `${newPath}${tab.path.slice(oldPath.length)}`,
          }
        }

        return tab
      }),
    })
  },

  closeTab: (tabId) => {
    const { activeTabId, openTabs, savingStatus, lastSavedAt } = get()
    const filtered = openTabs.filter((t) => t.id !== tabId)
    const { [tabId]: _removedSavingStatus, ...nextSavingStatus } = savingStatus
    const { [tabId]: _removedLastSavedAt, ...nextLastSavedAt } = lastSavedAt
    const updates: Partial<EditorState> = {
      openTabs: filtered,
      savingStatus: nextSavingStatus,
      lastSavedAt: nextLastSavedAt,
    }

    if (activeTabId === tabId) {
      const replacementActiveId = filtered[filtered.length - 1]?.id ?? null
      updates.activeTabId = replacementActiveId
      updates.selectedFileId = replacementActiveId
    }

    set(updates)
  },

  closeAllTabs: () => {
    set({
      openTabs: [],
      activeTabId: null,
      selectedFileId: null,
      savingStatus: {},
      lastSavedAt: {},
    })
  },

  setActiveTab: (tabId) => {
    const tab = get().openTabs.find((t) => t.id === tabId)
    if (tab) {
      set({ activeTabId: tabId })
    }
  },

  setActivityBarItem: (item) => set({ activityBarItem: item }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleChatPanel: (context) =>
    set((s) => ({
      chatOpenByContext: {
        ...s.chatOpenByContext,
        [context]: !s.chatOpenByContext[context],
      },
    })),
  activateFocusMode: (context) =>
    set((s) => ({
      sidebarCollapsed: true,
      chatOpenByContext: {
        ...s.chatOpenByContext,
        [context]: false,
      },
    })),
}))

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".")
  return idx >= 0 ? filename.slice(idx) : ""
}

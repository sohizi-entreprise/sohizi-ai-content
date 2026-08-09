import { create } from 'zustand'
import { toast } from 'sonner'
import type {
  EditorTab,
  FileTreeNode,
} from '../types'

interface EditorState {
  activeTabId: string | null
  openTabs: Array<EditorTab>
  selectedFileId: string | null
  activityBarItem: string
  sidebarCollapsed: boolean
  savingStatus: Record<string, 'saving' | 'saved' | 'error'>
  lastSavedAt: Record<string, string>
  showAiPanel: boolean

  setSavingStatus: (tabId: string, status: 'saving' | 'saved' | 'error') => void
  initLastSavedAt: (tabId: string, updatedAt: string) => void
  openFile: (node: FileTreeNode) => void
  openFileFromMention: (mention: { id: string; label: string; format: string }) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setActivityBarItem: (item: string) => void
  setSelectedFileId: (id: string | null) => void
  toggleSidebar: () => void
  toggleAiPanel: () => void
  activateFocusMode: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeTabId: null,
  openTabs: [],
  selectedFileId: null,
  activityBarItem: 'files' as const,
  sidebarCollapsed: false,
  savingStatus: {},
  lastSavedAt: {},
  showAiPanel: true,

  setSavingStatus: (tabId, status) => {
    if (status === 'saved') {
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
    const existing = openTabs.find((t) => t.id === node.id)
    if (existing) {
      set({
        activeTabId: node.id,
        selectedFileId: node.id,
      })
      return
    }
    const newTab: EditorTab = {
      id: node.id,
      name: node.name,
      extension: getFileExtension(node.name),
      format: node.format,
    }
    set({
      openTabs: [...openTabs, newTab],
      activeTabId: node.id,
      selectedFileId: node.id,
    })
  },

  openFileFromMention: (mention) => {
    if (!mention.id || !mention.format) {
      toast.error('Invalid file mention')
      return
    }

    const { openTabs } = get()
    const existing = openTabs.find((t) => t.id === mention.id)
    if (existing) {
      set({
        activeTabId: mention.id,
        selectedFileId: mention.id,
      })
      return
    }

    const newTab: EditorTab = {
      id: mention.id,
      name: mention.label,
      extension: getFileExtension(mention.label),
      format: mention.format,
    }

    set({
      openTabs: [...openTabs, newTab],
      activeTabId: mention.id,
      selectedFileId: mention.id,
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

  setActiveTab: (tabId) => {
    const tab = get().openTabs.find((t) => t.id === tabId)
    if (tab) {
      set({ activeTabId: tabId })
    }
  },

  setActivityBarItem: (item) => set({ activityBarItem: item }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleAiPanel: () => set((s) => ({ showAiPanel: !s.showAiPanel })),
  activateFocusMode: () => set({ showAiPanel: false, sidebarCollapsed: true }),
}))

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx) : ''
}

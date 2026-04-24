import { create } from 'zustand'
import type { EditorTab, ChatMessage, ActivityBarItem, FileNode } from '../types'
import { getFileExtension } from '../types'
import { MOCK_INITIAL_TABS, MOCK_CHAT_MESSAGES } from '../mock-data'

interface VideoEditorState {
  activeTabId: string | null
  openTabs: EditorTab[]
  splitView: boolean
  activePaneTab: { left: string | null; right: string | null }
  selectedFileId: string | null
  activityBarItem: ActivityBarItem
  aiMessages: ChatMessage[]
  sidebarCollapsed: boolean

  openFile: (node: FileNode) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  toggleSplitView: () => void
  moveTabToPane: (tabId: string, pane: 'left' | 'right') => void
  setActivityBarItem: (item: ActivityBarItem) => void
  setSelectedFileId: (id: string | null) => void
  toggleSidebar: () => void
}

export const useVideoEditorStore = create<VideoEditorState>((set, get) => ({
  activeTabId: MOCK_INITIAL_TABS[0]?.id ?? null,
  openTabs: MOCK_INITIAL_TABS,
  splitView: false,
  activePaneTab: { left: MOCK_INITIAL_TABS[0]?.id ?? null, right: null },
  selectedFileId: null,
  activityBarItem: 'files',
  aiMessages: MOCK_CHAT_MESSAGES,
  sidebarCollapsed: false,

  openFile: (node) => {
    if (node.children) return
    const { openTabs } = get()
    const existing = openTabs.find((t) => t.id === node.id)
    if (existing) {
      set({ activeTabId: node.id, selectedFileId: node.id, activePaneTab: { ...get().activePaneTab, [existing.pane]: node.id } })
      return
    }
    const pane = get().splitView ? 'right' : 'left'
    const newTab: EditorTab = {
      id: node.id,
      name: node.name,
      extension: getFileExtension(node.name),
      pane,
    }
    set({
      openTabs: [...openTabs, newTab],
      activeTabId: node.id,
      selectedFileId: node.id,
      activePaneTab: { ...get().activePaneTab, [pane]: node.id },
    })
  },

  closeTab: (tabId) => {
    const { openTabs, activeTabId, activePaneTab } = get()
    const tab = openTabs.find((t) => t.id === tabId)
    const filtered = openTabs.filter((t) => t.id !== tabId)
    const updates: Partial<VideoEditorState> = { openTabs: filtered }

    if (tab) {
      const samePaneTabs = filtered.filter((t) => t.pane === tab.pane)
      if (activePaneTab[tab.pane] === tabId) {
        updates.activePaneTab = {
          ...activePaneTab,
          [tab.pane]: samePaneTabs[samePaneTabs.length - 1]?.id ?? null,
        }
      }
    }

    if (activeTabId === tabId) {
      updates.activeTabId = filtered[filtered.length - 1]?.id ?? null
    }

    set(updates)
  },

  setActiveTab: (tabId) => {
    const tab = get().openTabs.find((t) => t.id === tabId)
    if (tab) {
      set({
        activeTabId: tabId,
        activePaneTab: { ...get().activePaneTab, [tab.pane]: tabId },
      })
    }
  },

  toggleSplitView: () => {
    set((s) => ({ splitView: !s.splitView }))
  },

  moveTabToPane: (tabId, pane) => {
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.id === tabId ? { ...t, pane } : t)),
      activePaneTab: { ...s.activePaneTab, [pane]: tabId },
    }))
  },

  setActivityBarItem: (item) => set({ activityBarItem: item }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

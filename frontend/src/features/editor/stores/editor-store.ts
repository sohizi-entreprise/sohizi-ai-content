import { create } from 'zustand'
import { getFileExtension } from '../types'
import { MOCK_CHAT_MESSAGES } from '../mock-data'
import type {
  ActivityBarItem,
  ChatMessage,
  EditorTab,
  FileTreeNode,
} from '../types'

type Pane = 'left' | 'right'

interface EditorState {
  activeTabId: string | null
  openTabs: Array<EditorTab>
  splitView: boolean
  activePaneTab: Record<Pane, string | null>
  selectedFileId: string | null
  activityBarItem: ActivityBarItem
  aiMessages: Array<ChatMessage>
  sidebarCollapsed: boolean

  openFile: (node: FileTreeNode) => void
  closeTab: (tabId: string) => void
  closePane: (pane: Pane) => void
  setActiveTab: (tabId: string) => void
  toggleSplitView: () => void
  moveTabToPane: (tabId: string, pane: Pane) => void
  setActivityBarItem: (item: ActivityBarItem) => void
  setSelectedFileId: (id: string | null) => void
  toggleSidebar: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeTabId: null,
  openTabs: [],
  splitView: false,
  activePaneTab: { left: null, right: null },
  selectedFileId: null,
  activityBarItem: 'files',
  aiMessages: MOCK_CHAT_MESSAGES,
  sidebarCollapsed: false,

  openFile: (node) => {
    if (node.directory) return
    const { openTabs } = get()
    const existing = openTabs.find((t) => t.id === node.id)
    if (existing) {
      set({
        activeTabId: node.id,
        selectedFileId: node.id,
        activePaneTab: { ...get().activePaneTab, [existing.pane]: node.id },
      })
      return
    }
    const pane = get().splitView ? 'right' : 'left'
    const newTab: EditorTab = {
      id: node.id,
      name: node.name,
      extension: getFileExtension(node.name),
      format: node.format,
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
    const { activePaneTab, activeTabId, openTabs, splitView } = get()
    const tab = openTabs.find((t) => t.id === tabId)
    const filtered = openTabs.filter((t) => t.id !== tabId)
    const updates: Partial<EditorState> = { openTabs: filtered }

    if (tab) {
      const samePaneTabs = filtered.filter((t) => t.pane === tab.pane)

      if (splitView && samePaneTabs.length === 0) {
        const remainingPane = tab.pane === 'left' ? 'right' : 'left'
        const remainingTabs = filtered.filter((t) => t.pane === remainingPane)
        const normalizedTabs = remainingTabs.map((remainingTab) => ({
          ...remainingTab,
          pane: 'left' as const,
        }))
        const activeId =
          activePaneTab[remainingPane] &&
          normalizedTabs.some(
            (remainingTab) => remainingTab.id === activePaneTab[remainingPane],
          )
            ? activePaneTab[remainingPane]
            : (normalizedTabs[normalizedTabs.length - 1]?.id ?? null)

        set({
          activePaneTab: { left: activeId, right: null },
          activeTabId: activeId,
          openTabs: normalizedTabs,
          selectedFileId: activeId,
          splitView: false,
        })
        return
      }

      if (activePaneTab[tab.pane] === tabId) {
        updates.activePaneTab = {
          ...activePaneTab,
          [tab.pane]: samePaneTabs[samePaneTabs.length - 1]?.id ?? null,
        }
      }

      if (activeTabId === tabId) {
        const replacementActiveId = samePaneTabs.length
          ? samePaneTabs[samePaneTabs.length - 1].id
          : (filtered[filtered.length - 1]?.id ?? null)

        updates.activeTabId = replacementActiveId
        updates.selectedFileId = replacementActiveId
      }
    }

    if (!tab && activeTabId === tabId) {
      updates.activeTabId = filtered[filtered.length - 1]?.id ?? null
      updates.selectedFileId = updates.activeTabId
    }

    set(updates)
  },

  closePane: (pane) => {
    const { activePaneTab, openTabs } = get()
    const remainingTabs = openTabs.filter((t) => t.pane !== pane)

    if (pane === 'left') {
      const normalizedTabs = remainingTabs.map((tab) => ({
        ...tab,
        pane: 'left' as const,
      }))
      const activeId =
        activePaneTab.right &&
        normalizedTabs.some((tab) => tab.id === activePaneTab.right)
          ? activePaneTab.right
          : (normalizedTabs[normalizedTabs.length - 1]?.id ?? null)

      set({
        activePaneTab: { left: activeId, right: null },
        activeTabId: activeId,
        openTabs: normalizedTabs,
        selectedFileId: activeId,
        splitView: false,
      })
      return
    }

    const activeId =
      activePaneTab.left &&
      remainingTabs.some((tab) => tab.id === activePaneTab.left)
        ? activePaneTab.left
        : (remainingTabs[remainingTabs.length - 1]?.id ?? null)

    set({
      activePaneTab: { left: activeId, right: null },
      activeTabId: activeId,
      openTabs: remainingTabs,
      selectedFileId: activeId,
      splitView: false,
    })
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
    set((s) => {
      if (s.splitView) {
        return { splitView: false }
      }

      const hasLeftTabs = s.openTabs.some((tab) => tab.pane === 'left')
      const hasRightTabs = s.openTabs.some((tab) => tab.pane === 'right')

      return { splitView: hasLeftTabs && hasRightTabs }
    })
  },

  moveTabToPane: (tabId, pane) => {
    set((s) => {
      const tab = s.openTabs.find((openTab) => openTab.id === tabId)
      if (!tab || tab.pane === pane) {
        return {}
      }

      const nextTabs = s.openTabs.map((openTab) =>
        openTab.id === tabId ? { ...openTab, pane } : openTab,
      )
      const hasLeftTabs = nextTabs.some((openTab) => openTab.pane === 'left')
      const hasRightTabs = nextTabs.some((openTab) => openTab.pane === 'right')

      if (!hasLeftTabs || !hasRightTabs) {
        return {}
      }

      const sourcePaneTabs = nextTabs.filter(
        (openTab) => openTab.pane === tab.pane,
      )
      const sourceActiveId =
        s.activePaneTab[tab.pane] === tabId
          ? (sourcePaneTabs[sourcePaneTabs.length - 1]?.id ?? null)
          : s.activePaneTab[tab.pane]

      return {
        activePaneTab: {
          ...s.activePaneTab,
          [tab.pane]: sourceActiveId,
          [pane]: tabId,
        },
        openTabs: nextTabs,
        splitView: true,
      }
    })
  },

  setActivityBarItem: (item) => set({ activityBarItem: item }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

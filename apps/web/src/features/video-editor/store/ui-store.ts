import { create } from "zustand"

export type LibraryTab = "assets" | "text" | "captions"
export type LeftPanelTab = LibraryTab | "adjust"

export type SaveStatus = "idle" | "saving" | "saved"

/** The render job the export UI is following, scoped to its composition. */
export type ActiveRender = { compositionId: string; jobId: string }

interface VideoEditorUiState {
  leftTab: LeftPanelTab
  lastLibraryTab: LibraryTab
  saveStatus: SaveStatus
  activeRender: ActiveRender | null
  /** Preview playback rate. Does not change the exported video. */
  playbackRate: number
  setLeftTab: (tab: LeftPanelTab) => void
  setSaveStatus: (status: SaveStatus) => void
  setActiveRender: (render: ActiveRender | null) => void
  setPlaybackRate: (rate: number) => void
}

/**
 * Chrome-only state. Kept out of `useVideoEditorStore` so it never reaches the
 * undo history or the autosave diff.
 */
export const useVideoEditorUiStore = create<VideoEditorUiState>()((set) => ({
  leftTab: "assets",
  lastLibraryTab: "assets",
  saveStatus: "idle",
  activeRender: null,
  playbackRate: 1,

  setLeftTab: (tab) =>
    set((s) => ({
      leftTab: tab,
      lastLibraryTab: tab === "adjust" ? s.lastLibraryTab : tab,
    })),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setActiveRender: (activeRender) => set({ activeRender }),

  setPlaybackRate: (playbackRate) => set({ playbackRate }),
}))

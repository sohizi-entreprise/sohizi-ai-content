import { create } from 'zustand'
import type { 
  EditorState, 
  EditorMode, 
  SelectionContext, 
  AISuggestion, 
  AIComment,
  PageInfo 
} from './types'

type EditorActions = {
  // Mode
  setMode: (mode: EditorMode) => void
  
  // Selection
  setSelection: (selection: SelectionContext | null) => void
  clearSelection: () => void
  
  // AI Suggestions
  addSuggestion: (suggestion: AISuggestion) => void
  acceptSuggestion: (id: string) => void
  rejectSuggestion: (id: string) => void
  clearSuggestions: () => void
  toggleShowDiffs: () => void
  
  // Comments
  addComment: (comment: AIComment) => void
  resolveComment: (id: string) => void
  deleteComment: (id: string) => void
  
  // Pagination
  setPages: (pages: PageInfo[]) => void
  setCurrentPage: (page: number) => void
  
  // Block Menu
  openBlockMenu: (position: { x: number; y: number }) => void
  closeBlockMenu: () => void
  
  // Active Block
  setActiveBlockId: (id: string | null) => void
  
  // Reset
  reset: () => void
}

const initialState: EditorState = {
  mode: 'edit',
  selection: null,
  pendingSuggestions: [],
  comments: [],
  showDiffs: true,
  pages: [],
  currentPage: 1,
  isBlockMenuOpen: false,
  blockMenuPosition: null,
  activeBlockId: null,
}

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  ...initialState,

  // Mode
  setMode: (mode) => set({ mode }),

  // Selection
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: null }),

  // AI Suggestions
  addSuggestion: (suggestion) =>
    set((state) => ({
      pendingSuggestions: [...state.pendingSuggestions, suggestion],
    })),

  acceptSuggestion: (id) =>
    set((state) => ({
      pendingSuggestions: state.pendingSuggestions.map((s) =>
        s.id === id ? { ...s, status: 'accepted' as const } : s
      ),
    })),

  rejectSuggestion: (id) =>
    set((state) => ({
      pendingSuggestions: state.pendingSuggestions.map((s) =>
        s.id === id ? { ...s, status: 'rejected' as const } : s
      ),
    })),

  clearSuggestions: () => set({ pendingSuggestions: [] }),

  toggleShowDiffs: () => set((state) => ({ showDiffs: !state.showDiffs })),

  // Comments
  addComment: (comment) =>
    set((state) => ({
      comments: [...state.comments, comment],
    })),

  resolveComment: (id) =>
    set((state) => ({
      comments: state.comments.map((c) =>
        c.id === id ? { ...c, resolved: true } : c
      ),
    })),

  deleteComment: (id) =>
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== id),
    })),

  // Pagination
  setPages: (pages) => set({ pages }),
  setCurrentPage: (currentPage) => set({ currentPage }),

  // Block Menu
  openBlockMenu: (position) =>
    set({ isBlockMenuOpen: true, blockMenuPosition: position }),
  closeBlockMenu: () =>
    set({ isBlockMenuOpen: false, blockMenuPosition: null }),

  // Active Block
  setActiveBlockId: (activeBlockId) => set({ activeBlockId }),

  // Reset
  reset: () => set(initialState),
}))

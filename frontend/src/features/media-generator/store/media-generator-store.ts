import { create } from 'zustand'
import { toast } from 'sonner'
import { defaultMediaSettings } from '../constants'
import { createMockMediaItem } from '../mock-media'
import type {
  GenerateMediaInput,
  GeneratedMediaItem,
  MediaFilter,
  MediaGenerationSettings,
  MediaType,
} from '../types'
import { saveFileContent } from '@/features/editor/requests'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'
import { createFileNode } from '@/features/projects/request'

type MediaGeneratorState = {
  items: Array<GeneratedMediaItem>
  filter: MediaFilter
  activeType: MediaType
  settingsPrompt: string
  settings: MediaGenerationSettings
  previewItemId: string | null
  setFilter: (filter: MediaFilter) => void
  setActiveType: (type: MediaType) => void
  setSettingsPrompt: (prompt: string) => void
  updateSettings: <T extends MediaType>(
    type: T,
    patch: Partial<MediaGenerationSettings[T]>,
  ) => void
  generateMedia: (input: GenerateMediaInput) => GeneratedMediaItem
  deleteItem: (id: string) => void
  setPreviewItem: (id: string | null) => void
  moveItemToFile: (projectId: string, item: GeneratedMediaItem) => Promise<void>
}

function getMediaUrl(item: GeneratedMediaItem) {
  return item.variants?.[0]?.url ?? item.url ?? item.thumbnailUrl ?? ''
}

function buildMediaMarkdown(item: GeneratedMediaItem) {
  const mediaUrl = getMediaUrl(item)
  const settings = Object.entries(item.settings)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')

  return `# ${item.title}

Type: ${item.type}
Model: ${item.model}
Prompt: ${item.prompt}

${mediaUrl}

## Settings

${settings}
`
}

export const useMediaGeneratorStore = create<MediaGeneratorState>(
  (set, get) => ({
    items: [],
    filter: 'all',
    activeType: 'image',
    settingsPrompt: '',
    settings: defaultMediaSettings,
    previewItemId: null,

    setFilter: (filter) => set({ filter }),
    setActiveType: (type) => set({ activeType: type }),
    setSettingsPrompt: (settingsPrompt) => set({ settingsPrompt }),
    updateSettings: (type, patch) =>
      set((state) => ({
        settings: {
          ...state.settings,
          [type]: {
            ...state.settings[type],
            ...patch,
          },
        },
      })),
    generateMedia: (input) => {
      const item = createMockMediaItem(input, get().settings)
      set((state) => ({ items: [item, ...state.items] }))
      return item
    },
    deleteItem: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        previewItemId: state.previewItemId === id ? null : state.previewItemId,
      })),
    setPreviewItem: (id) => set({ previewItemId: id }),
    moveItemToFile: async (projectId, item) => {
      const { rootFolderId, treeData, insertNodeAt } =
        useFileTreeStore.getState()

      if (!rootFolderId) {
        toast.error('Open a project folder before moving media to a file.')
        return
      }

      try {
        const fileName = `${
          item.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || item.type
        }.md`
        const created = await createFileNode(projectId, {
          name: fileName,
          directory: false,
          parentId: rootFolderId,
          position: treeData.length,
          format: 'markdown',
        })

        await saveFileContent(projectId, created.id, buildMediaMarkdown(item))
        insertNodeAt(
          rootFolderId,
          { ...created, children: undefined },
          treeData.length,
        )
        toast.success('Media moved to a project file.')
      } catch (error) {
        console.error('Failed to move media to file', error)
        toast.error('Could not move this media to a file yet.')
      }
    },
  }),
)

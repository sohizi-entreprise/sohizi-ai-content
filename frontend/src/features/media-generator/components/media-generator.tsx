import { ImagePlus, Sparkles } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { mediaFilterOptions } from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { MediaCard } from './media-card'
import { MediaPreviewDialog } from './media-preview-dialog'
import { MediaSettingsDialog } from './media-settings-dialog'
import type { GeneratedMediaItem, MediaFilter } from '../types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export function MediaGenerator() {
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const items = useMediaGeneratorStore((state) => state.items)
  const filter = useMediaGeneratorStore((state) => state.filter)
  const setFilter = useMediaGeneratorStore((state) => state.setFilter)
  const previewItemId = useMediaGeneratorStore((state) => state.previewItemId)
  const setPreviewItem = useMediaGeneratorStore((state) => state.setPreviewItem)
  const deleteItem = useMediaGeneratorStore((state) => state.deleteItem)
  const moveItemToFile = useMediaGeneratorStore((state) => state.moveItemToFile)

  const visibleItems =
    filter === 'all' ? items : items.filter((item) => item.type === filter)
  const previewItem = items.find((item) => item.id === previewItemId) ?? null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <header className="border-b border-white/10 bg-black/20 px-6 py-5 flex items-center justify-between">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Sparkles className="size-4" />
              AI media
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Media generator history
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View all your generated media for this project.
            </p>
          </div>

          
        </div>

        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as MediaFilter)}
          className="mt-5"
        >
          <TabsList className="h-11 rounded-2xl border border-white/10 bg-black/40 p-1">
            {mediaFilterOptions.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className={cn(
                  'rounded-xl px-5 text-sm text-zinc-300',
                  'data-[state=active]:bg-white/15 data-[state=active]:text-white',
                )}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <ScrollArea className="flex-1">
        <main className="p-6">
          {visibleItems.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onPreview={(nextItem) => setPreviewItem(nextItem.id)}
                  onDelete={deleteItem}
                  onMoveToFile={(nextItem: GeneratedMediaItem) =>
                    void moveItemToFile(projectId, nextItem)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyMediaState />
          )}
        </main>
      </ScrollArea>

      <MediaSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <MediaPreviewDialog
        item={previewItem}
        open={!!previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null)
        }}
      />
    </div>
  )
}

function EmptyMediaState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/10">
          <ImagePlus className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">
          No media generated yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the media settings to create mock images, videos, or audio for
          this project.
        </p>
      </div>
    </div>
  )
}

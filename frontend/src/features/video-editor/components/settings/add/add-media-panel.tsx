import { FolderOpen, Type } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TextPresetsPanel } from './text-presets-panel'
import { AssetsPanel } from './assets-panel'
import { LibraryDragLayer } from './library-drag-layer'

export function AddMediaPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <LibraryDragLayer />
      <h2 className="shrink-0 px-1 pb-3 text-base font-semibold text-foreground">
        Add
      </h2>
      <Tabs defaultValue="text" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList className="h-auto w-full shrink-0 justify-start gap-1 rounded-xl bg-muted/50 p-1">
          <TabsTrigger
            value="text"
            className="flex-1 gap-1.5 rounded-lg px-2 py-2 text-xs data-[state=active]:shadow-sm"
          >
            <Type className="size-3.5" />
            Text
          </TabsTrigger>
          <TabsTrigger
            value="assets"
            className="flex-1 gap-1.5 rounded-lg px-2 py-2 text-xs data-[state=active]:shadow-sm"
          >
            <FolderOpen className="size-3.5" />
            Assets
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="text"
          className="mt-0 min-h-0 flex-1 overflow-y-auto px-0.5 pb-2"
        >
          <TextPresetsPanel />
        </TabsContent>
        <TabsContent
          value="assets"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-0.5 pb-2"
        >
          <AssetsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

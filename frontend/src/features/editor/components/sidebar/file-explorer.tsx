import { Plus, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree } from './file-tree'

export function FileExplorer() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 px-1">
        <FileTree />
      </ScrollArea>
    </div>
  )
}

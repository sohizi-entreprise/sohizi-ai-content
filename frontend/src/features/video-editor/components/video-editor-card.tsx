import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Clapperboard } from 'lucide-react'
import type { FileNode } from '@/features/projects/type'

type VideoEditorCardProps = {
  file: FileNode
}

export function VideoEditorCard({ file }: VideoEditorCardProps) {
  return (
    <Card className="glass-panel flex h-full cursor-pointer flex-col gap-4 rounded-2xl transition-all duration-400 hover:border-primary/30! group">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Clapperboard className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-lg font-bold text-white transition-all duration-300 group-hover:text-primary">
              {file.name}
            </CardTitle>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Video editor
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-6">
        <div className="space-y-3">
          <div className="h-2 w-1/3 rounded-full bg-slate-400/10" />
          <div className="h-2 w-full rounded-full bg-slate-400/10" />
          <div className="mx-auto h-2 w-[90%] rounded-full bg-slate-400/8" />
          <div className="h-2 w-[85%] rounded-full bg-slate-400/6" />
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Open to edit
        </p>
      </CardFooter>
    </Card>
  )
}

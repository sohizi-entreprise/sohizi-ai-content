import { Monitor } from 'lucide-react'
import { useVideoEditorStore } from '../store/editor-store'
import type { AspectRatio } from '../store/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const RATIOS: Array<AspectRatio> = ['16:9', '9:16', '1:1', '4:5']

export function AspectRatioSelect() {
  const aspectRatio = useVideoEditorStore((s) => s.aspectRatio)
  const setAspectRatio = useVideoEditorStore((s) => s.setAspectRatio)

  return (
    <Select
      value={aspectRatio}
      onValueChange={(v) => setAspectRatio(v as AspectRatio)}
    >
      <SelectTrigger size="sm" className="h-7 gap-2 px-2 text-xs">
        <Monitor className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {RATIOS.map((r) => (
          <SelectItem key={r} value={r} className="text-xs">
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

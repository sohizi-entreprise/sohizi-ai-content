import {
  Files,
  Search,
  GitBranch,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { useEditorStore } from '../../stores/editor-store'
import type { ActivityBarItem } from '../../types'

const ITEMS: { id: ActivityBarItem; icon: typeof Files; label: string }[] = [
  { id: 'files', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'extensions', icon: Play, label: 'Run & Debug' },
]

export function ActivityBar() {
  const active = useEditorStore((s) => s.activityBarItem)
  const setActive = useEditorStore((s) => s.setActivityBarItem)
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar)

  const handleClick = (id: ActivityBarItem) => {
    if (active === id) {
      toggleSidebar()
    } else {
      setActive(id)
      const { sidebarCollapsed } = useEditorStore.getState()
      if (sidebarCollapsed) toggleSidebar()
    }
  }

  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-between py-2 backdrop-blur-md">
      <div className="flex flex-col items-center gap-1">
        {ITEMS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleClick(id)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md transition-colors',
                  active === id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
                )}
              >
                <Icon className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger>
            <div className="size-7 rounded-full bg-primary/20 ring-2 ring-primary/40 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">JD</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

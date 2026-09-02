import { Clapperboard, Files, Play, Sparkles } from "lucide-react"
import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@sohizi/ui/tooltip"
import { useEditorStore } from "@/features/editor/stores/editor-store"

const ITEMS = [
  {
    id: "files",
    icon: Files,
    label: "Explorer",
    link: "/dashboard/projects/$projectId/editor",
  },
  {
    id: "media-generator",
    icon: Play,
    label: "AI media generator",
    link: "/dashboard/projects/$projectId/generate",
  },
  {
    id: "video-editor",
    icon: Clapperboard,
    label: "Video editor",
    link: "/dashboard/projects/$projectId/video-editor",
  },
  {
    id: "skill-market",
    icon: Sparkles,
    label: "Skill market",
    link: "/dashboard/projects/$projectId/skill-market",
  },
] as const

type ActivityBarItem = (typeof ITEMS)[number]["id"]

function resolvePathname(link: string, projectId: string) {
  return link.replace("$projectId", projectId)
}

export function AppNavBar() {
  const setActive = useEditorStore((s) => s.setActivityBarItem)
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar)
  const { projectId } = useParams({ from: "/dashboard/projects/$projectId" })
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const activeItem = ITEMS.find((item) =>
    pathname.startsWith(resolvePathname(item.link, projectId)),
  )?.id

  const handleClick = (id: ActivityBarItem) => {
    if (activeItem === id) {
      toggleSidebar()
    } else {
      setActive(id)
      const { sidebarCollapsed } = useEditorStore.getState()
      if (sidebarCollapsed) toggleSidebar()
    }
  }

  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-between py-2 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        {ITEMS.map(({ id, icon: Icon, label, link }) => (
          <Link
            key={id}
            from="/dashboard/projects/$projectId"
            to={link}
            params={{ projectId }}
            onClick={() => handleClick(id)}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md transition-colors",
                    activeItem === id
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          </Link>
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

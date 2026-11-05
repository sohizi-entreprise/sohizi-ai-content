import { ChevronDown } from "lucide-react"
import { useSuspenseInfiniteQuery } from "@tanstack/react-query"
import { Suspense, useMemo, useState } from "react"
import { Link, useParams, useRouterState } from "@tanstack/react-router"
import {
  IconCheck,
  IconFocus2,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
} from "@tabler/icons-react"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { Skeleton } from "@sohizi/ui/skeleton"
import { ColibriMascot } from "@sohizi/ui/colibri-mascot"
import type { ProjectListItem } from "@/features/projects/type"
import { getListProjectsQueryOptions } from "@/features/projects/query-mutation"
import { useSession } from "@/lib/auth-client"
import {
  getChatChromeContext,
  useEditorStore,
} from "@/features/editor/stores/editor-store"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const chatContext = getChatChromeContext(pathname)
  const toggleChatPanel = useEditorStore((s) => s.toggleChatPanel)
  const activateFocusMode = useEditorStore((s) => s.activateFocusMode)
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar)
  const sidebarCollapsed = useEditorStore((s) => s.sidebarCollapsed)
  const isEditorPage =
    pathname.includes("/editor") && !pathname.includes("/video-editor")
  const isMediaPage = pathname.includes("/generate")
  const isSkillMarket = pathname.includes("/skill-market")

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-border  px-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img
            src="/logo-monochrome-white.svg"
            alt="sohizi lab monochrome white"
            className="size-8 shrink-0 object-contain relative -top-1 opacity-75"
          />

          <div className="flex items-center gap-2">
            {isEditorPage && (
              <>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={
                    sidebarCollapsed
                      ? "Show file explorer"
                      : "Hide file explorer"
                  }
                  className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <IconLayoutSidebar className="size-5" />
                </button>

                <span className="text-muted-foreground/40">|</span>
              </>
            )}

            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              All Projects
            </Link>

            <span className="text-muted-foreground/40">|</span>

            <Suspense fallback={<Skeleton className="w-20 h-7" />}>
              <ProjectDropdown />
            </Suspense>
          </div>
        </div>
      </div>

      <div className={cn("flex items-center gap-4", isSkillMarket && "hidden")}>
        <button
          onClick={() => activateFocusMode(chatContext)}
          className="cursor-pointer"
        >
          <IconFocus2 className="size-5 text-foreground" />
        </button>

        {isMediaPage && (
          <button
            onClick={() => toggleChatPanel(chatContext)}
            className="cursor-pointer"
          >
            <IconLayoutSidebarRight className="size-5 text-foreground" />
          </button>
        )}

        {isEditorPage && (
          <button
            onClick={() => toggleChatPanel(chatContext)}
            className="cursor-pointer flex items-center gap-2 border rounded-xl px-2 py-1"
          >
            <ColibriMascot state="idle" size={24} />
            <span className="text-sm font-medium">Ask Koli</span>
          </button>
        )}
      </div>
    </header>
  )
}

const ProjectDropdown = () => {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId ?? undefined

  if (!organizationId) {
    return <Skeleton className="w-24 h-6" />
  }

  return <ProjectDropdownContent organizationId={organizationId} />
}

const ProjectDropdownContent = ({
  organizationId,
}: {
  organizationId: string
}) => {
  const { data: projects = [] } = useSuspenseInfiniteQuery(
    getListProjectsQueryOptions({
      cursor: undefined,
      limit: 20,
      organizationId,
    }),
  )
  const [open, setOpen] = useState(false)

  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId",
  })

  const closeAllTabs = useEditorStore((s) => s.closeAllTabs)

  const handleLinkClick = (nextProjectId: string) => {
    setOpen(false)
    if (nextProjectId !== projectId) {
      closeAllTabs()
    }
  }

  const currentProjectTitle = useMemo(
    () => projects.find((project) => project.id === projectId)?.title,
    [projects, projectId],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-foreground hover:text-foreground cursor-pointer"
        >
          <span className="text-sm">{currentProjectTitle}</span>
          <ChevronDown className="size-4 mt-1" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-2xl h-[70%] max-h-200 rounded-xl flex flex-col"
        // showCloseButton={false}
      >
        <DialogDescription className="sr-only">
          Projects settings
        </DialogDescription>
        <DialogHeader>
          <DialogTitle>Select a project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col h-full min-h-0 flex-1">
          {projects.map((project) => (
            <ProjectItem
              project={project}
              handleLinkClick={handleLinkClick}
              key={project.id}
              isCurrentProject={project.id === projectId}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ProjectItem = ({
  project,
  handleLinkClick,
  isCurrentProject,
}: {
  project: ProjectListItem
  handleLinkClick: (nextProjectId: string) => void
  isCurrentProject: boolean
}) => {
  return (
    <Link
      to="/projects/$projectId/editor"
      params={{ projectId: project.id }}
      key={project.id}
      className="w-full"
      onClick={() => handleLinkClick(project.id)}
    >
      <div
        key={project.id}
        className="w-full border-b dark:border-white/5 group py-2 cursor-pointer flex items-center gap-2"
      >
        {isCurrentProject && <IconCheck className="size-4 text-primary" />}
        <span
          className={cn(
            "text-foreground group-hover:text-primary",
            isCurrentProject && "text-foreground",
          )}
        >
          {project.title}
        </span>
      </div>
    </Link>
  )
}

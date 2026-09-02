import { ChevronDown } from "lucide-react"
import { useSuspenseInfiniteQuery } from "@tanstack/react-query"
import { Suspense, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { IconBrain, IconFocus2, IconX } from "@tabler/icons-react"
import { Button } from "@sohizi/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { getListProjectsQueryOptions } from "@/features/projects/query-mutation"
import { Skeleton } from "@sohizi/ui/skeleton"
import { useSession } from "@/lib/auth-client"
import {
  getChatChromeContext,
  useEditorStore,
} from "@/features/editor/stores/editor-store"
import { useFileTreeStore } from "@/features/editor/stores/file-tree-store"

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const chatContext = getChatChromeContext(pathname)
  const toggleChatPanel = useEditorStore((s) => s.toggleChatPanel)
  const activateFocusMode = useEditorStore((s) => s.activateFocusMode)

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-border  px-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt=""
            width={32}
            height={28}
            className="h-7 w-8 shrink-0 object-contain sm:h-8 sm:w-9 -mt-2"
          />
          <span className="text-sm font-semibold text-muted-foreground">
            Sohizi Lab
          </span>
        </div>

        <span className="text-muted-foreground/40">|</span>

        <Suspense fallback={<Skeleton className="w-20 h-7" />}>
          <ProjectDropdown />
        </Suspense>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <button onClick={() => activateFocusMode(chatContext)}>
          <IconFocus2 className="size-5 text-foreground" />
        </button>

        <button onClick={() => toggleChatPanel(chatContext)}>
          {<IconBrain className="size-5 text-primary" />}
        </button>
      </div>
    </header>
  )
}

const ProjectDropdown = () => {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId ?? undefined

  if (!organizationId) {
    return <Skeleton className="w-20 h-7" />
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
  const currentProjectTitle = useFileTreeStore((state) => state.project?.title)
  const [open, setOpen] = useState(false)

  const handleLinkClick = () => {
    setOpen(false)
  }

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
        className="sm:max-w-2xl h-[70%] max-h-[800px] bg-gray-800 rounded-xl flex flex-col"
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">
          Projects settings
        </DialogDescription>
        <DialogHeader>
          <DialogTitle>All Projects</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 h-full min-h-0 flex-1">
          {projects.map((project) => (
            <Link
              to="/dashboard/projects/$projectId/editor"
              params={{ projectId: project.id }}
              key={project.id}
              className="w-full"
              onClick={handleLinkClick}
            >
              <div
                key={project.id}
                className="w-full border-b dark:border-white/10 hover:bg-gray-200/10 hover:rounded-lg px-4 py-2 cursor-pointer"
              >
                {project.title}
              </div>
            </Link>
          ))}
        </div>

        <div className="absolute -top-8 -right-8">
          <DialogClose asChild>
            <Button
              size="icon"
              className="border dark:border-gray-700 rounded-full"
            >
              <IconX className="size-4" />
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

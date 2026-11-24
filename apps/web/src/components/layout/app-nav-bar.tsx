import { useState } from "react"
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sohizi/ui/tooltip"
import {
  IconCategoryFilled,
  IconFilesFilled,
  IconMessageReportFilled,
  IconPhotoFilled,
  IconUserFilled,
  // IconVideoPlusFilled,
} from "@tabler/icons-react"
import { FeedbackDialog } from "@/features/feedback/components/feedback-dialog"
import {
  ACCOUNT_PREFERENCES_TAB_ID,
  useEditorStore,
} from "@/features/editor/stores/editor-store"
import { cn } from "@/lib/utils"

const ITEMS = [
  {
    id: "files",
    icon: IconFilesFilled,
    label: "Files explorer",
    link: "/projects/$projectId/editor",
  },
  {
    id: "media-generator",
    icon: IconPhotoFilled,
    label: "AI media generator",
    link: "/projects/$projectId/generate",
  },
  // {
  //   id: "video-editor",
  //   icon: IconVideoPlusFilled,
  //   label: "Video editor",
  //   link: "/projects/$projectId/video-editor",
  // },
  {
    id: "skill-market",
    icon: IconCategoryFilled,
    label: "Skill market",
    link: "/projects/$projectId/skill-market",
  },
] as const

function resolvePathname(link: string, projectId: string) {
  return link.replace("$projectId", projectId)
}

export function AppNavBar() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId",
  })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const openAccountPreferencesTab = useEditorStore(
    (s) => s.openAccountPreferencesTab,
  )

  const activeItem = ITEMS.find((item) =>
    pathname.startsWith(resolvePathname(item.link, projectId)),
  )?.id
  const isAccountTabActive =
    activeItem === "files" && activeTabId === ACCOUNT_PREFERENCES_TAB_ID

  const handleOpenAccountTab = () => {
    openAccountPreferencesTab()
    const editorPathname = resolvePathname(
      "/projects/$projectId/editor",
      projectId,
    )
    if (!pathname.startsWith(editorPathname)) {
      void navigate({
        to: "/projects/$projectId/editor",
        params: { projectId },
      })
    }
  }

  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-between py-2 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        {ITEMS.map(({ id, icon: Icon, label, link }) => (
          <Link
            key={id}
            from="/projects/$projectId"
            to={link}
            params={{ projectId }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer",
                    activeItem === id
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          </Link>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Feedback and bug report"
              onClick={() => setFeedbackOpen(true)}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground cursor-pointer"
            >
              <IconMessageReportFilled className="size-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Feedback & bug report</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Account profile"
              onClick={handleOpenAccountTab}
              className={cn(
                "flex size-9 items-center justify-center rounded-md transition-colors cursor-pointer",
                isAccountTabActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
              )}
            >
              <IconUserFilled className="size-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Account profile</TooltipContent>
        </Tooltip>
      </div>

      <FeedbackDialog
        projectId={projectId}
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  )
}

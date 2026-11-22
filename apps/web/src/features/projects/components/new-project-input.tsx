import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
import { IconCircleChevronRightFilled, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { DotsLoader } from "@sohizi/ui/loaders"
import { Badge } from "@sohizi/ui/badge"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { useRef, useState } from "react"
import {
  createProjectMutationOptions,
  getProjectOptionsQueryOptions,
} from "../query-mutation"
import { createProjectSchema } from "../schema"
import {
  isAdditionalSettingKey,
  useNewProjectStore,
} from "../store/new-project-store"
import NewProjectSettings from "./new-project-settings"
import StoryIdeaEditor from "./story-idea-editor"
import type { Editor } from "@tiptap/core"

export default function NewProjectInput() {
  const {
    storyIdea,
    setStoryIdea,
    additionalSettings,
    validate,
    clearAdditionalSetting,
    reset,
  } = useNewProjectStore()

  const { mutate: createProject, isPending } = useMutation(
    createProjectMutationOptions,
  )
  const { data: projectOptions } = useQuery(
    getProjectOptionsQueryOptions("project"),
  )
  const navigate = useNavigate()

  const editorRef = useRef<Editor>(null)
  const [nameOpen, setNameOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [titleError, setTitleError] = useState("")

  const selectedSettings = (projectOptions?.presets ?? []).flatMap((preset) => {
    if (!isAdditionalSettingKey(preset.key)) return []
    const value = additionalSettings[preset.key]
    if (!value) return []
    return [{ key: preset.key, label: preset.label, value }]
  })

  const canSubmit =
    Boolean(storyIdea.trim()) ||
    Object.values(additionalSettings).some((value) => value !== null)

  const onSubmit = () => {
    const { valid, errors } = validate()
    if (!valid) {
      errors.forEach((error) => {
        toast.error(error)
      })
      return
    }
    setTitle("")
    setTitleError("")
    setNameOpen(true)
  }

  const onConfirmName = () => {
    const presets = (projectOptions?.presets ?? []).flatMap((preset) => {
      if (!isAdditionalSettingKey(preset.key)) return []
      const selected = additionalSettings[preset.key]
      if (!selected) return []
      return [{ id: preset.id, value: selected.value }]
    })
    const trimmedBrief = storyIdea.trim()
    const payload = {
      title: title.trim(),
      ...(trimmedBrief ? { brief: trimmedBrief } : {}),
      presets,
    }
    const output = createProjectSchema.safeParse(payload)
    if (!output.success) {
      setTitleError(output.error.issues[0]?.message ?? "Invalid project name")
      return
    }

    createProject(output.data, {
      onSuccess: async (response) => {
        captureAnalyticsEvent("project_created", {
          project_id: response.id,
          mode: "guided",
        })
        reset()
        editorRef.current?.commands.clearContent()
        setNameOpen(false)
        await navigate({
          to: "/projects/$projectId/editor",
          params: {
            projectId: response.id,
          },
        })
      },
    })
  }

  const handleCardMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest("button, a, input, [role='menuitem']")) {
      return
    }

    const editor = editorRef.current
    if (!editor || editor.view.dom.contains(target)) {
      return
    }

    editor.commands.focus("end")
  }

  return (
    <div className="space-y-3">
      <div
        className="relative h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg backdrop-blur-sm transition-colors focus-within:border-white/25 sm:p-6"
        onMouseDown={handleCardMouseDown}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
          <h2 className="text-sm font-semibold text-white">
            Start from a brief
          </h2>

          <NewProjectSettings />
        </div>

        {selectedSettings.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {selectedSettings.map((setting) => (
              <Badge
                key={setting.key}
                variant="secondary"
                className="gap-1.5 rounded-full border-white/10 bg-white/6 px-3 py-1 pr-2 text-xs text-foreground/90"
              >
                <span className="text-muted-foreground">{setting.label}:</span>{" "}
                {setting.value.label}
                <button
                  type="button"
                  aria-label={`Remove ${setting.label}`}
                  className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                  onClick={() => clearAdditionalSetting(setting.key)}
                >
                  <IconX className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="max-h-52 min-h-28 min-w-0 w-full flex-1 overflow-y-auto text-white">
          <StoryIdeaEditor
            onChange={setStoryIdea}
            onSubmit={onSubmit}
            ref={(editor) => (editorRef.current = editor)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            {selectedSettings.length > 0
              ? `${selectedSettings.length} direction ${selectedSettings.length === 1 ? "setting" : "settings"} selected`
              : "Optional: use Settings to define format, genre, tone, and aspect ratio."}
          </p>

          <Button
            variant="default"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold cursor-pointer"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            Create from brief
            <IconCircleChevronRightFilled className="size-5" />
          </Button>
        </div>

        <LoaderOverlay isLoading={isPending} />
      </div>

      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name your project</DialogTitle>
            <DialogDescription>
              Give this project a name before creating it from your brief.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              onConfirmName()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="project-title">Project name</Label>
              <Input
                id="project-title"
                type="text"
                placeholder="Short film storyboard"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setTitleError("")
                }}
                autoFocus
              />
            </div>
            {titleError ? (
              <p className="text-sm text-destructive">{titleError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNameOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !title.trim()}>
                {isPending ? "Creating..." : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoaderOverlay({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null
  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-background/10 backdrop-blur-xs">
      <DotsLoader />
    </div>
  )
}

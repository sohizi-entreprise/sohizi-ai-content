import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
import { ChevronDown } from "lucide-react"
import {
  IconCircleChevronRightFilled,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
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
import DropMenuSettings from "./drop-menu-settings"
import NewProjectSelectModel from "./new-project-select-model"
import NewProjectSettings from "./new-project-settings"
import StoryIdeaEditor from "./story-idea-editor"
import type { ProjectAttachment } from "../store/new-project-store"
import type { Editor } from "@tiptap/core"
import {
  Attachment,
  AttachmentHoverCard,
  AttachmentHoverCardContent,
  AttachmentHoverCardTrigger,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  getAttachmentLabel,
  getMediaCategory,
} from "@/components/ai-elements/attachments"
import { useFileUpload } from "@/hooks/use-file-upload"
import { cn } from "@/lib/utils"

export default function NewProjectInput() {
  const {
    storyIdea,
    setStoryIdea,
    additionalSettings,
    validate,
    modelId,
    commandId,
    setCommandId,
    clearAdditionalSetting,
    attachments,
    addAttachments,
    removeAttachment,
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

  const commands = projectOptions?.commands ?? []
  const selectedCommand =
    commands.find((command) => command.id === commandId) ?? commands.at(0)

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
    const payload = {
      title: title.trim(),
      presets,
      commandId: selectedCommand?.id ?? null,
      modelId,
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

  const selectedSettings = (projectOptions?.presets ?? []).flatMap((preset) => {
    if (!isAdditionalSettingKey(preset.key)) return []
    const value = additionalSettings[preset.key]
    if (!value) return []
    return [{ key: preset.key, label: preset.label, value }]
  })

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
      {selectedSettings.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selectedSettings.map((setting) => (
            <Badge
              key={setting.key}
              variant="secondary"
              className="gap-1.5 rounded-full border-white/10 bg-white/5 px-3 py-1.5 pr-2 text-xs text-slate-400"
            >
              {setting.label}: {setting.value.label}
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

      <div
        className="relative h-fit rounded-2xl border border-border bg-white/5 p-4 shadow-sm focus-within:ring-1 focus-within:ring-white sm:p-5"
        onMouseDown={handleCardMouseDown}
      >
        <div className="flex flex-col items-start gap-3">
          <div className="flex shrink-0 items-center gap-1">
            <AddAttachment
              onFilesAdded={addAttachments}
              onError={(message) => toast.error(message)}
            />
            {attachments.length > 0 ? (
              <AttachmentStack
                attachments={attachments}
                onRemove={removeAttachment}
              />
            ) : null}
          </div>
          <div className="max-h-45 min-w-0 w-full flex-1 overflow-y-auto text-white">
            <StoryIdeaEditor
              onChange={setStoryIdea}
              onSubmit={onSubmit}
              ref={(editor) => (editorRef.current = editor)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <DropMenuSettings
              options={commands.map((command) => ({
                label: command.name,
                value: command.id,
              }))}
              onSelect={setCommandId}
            >
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/5"
              >
                <span className="max-w-50 truncate">
                  /{selectedCommand?.name ?? "Command"}
                </span>
                <ChevronDown className="size-4 opacity-50" />
              </button>
            </DropMenuSettings>
            <NewProjectSettings />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NewProjectSelectModel />
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold"
              onClick={onSubmit}
              disabled={!storyIdea.trim()}
            >
              Start project
              <IconCircleChevronRightFilled className="size-6" />
            </Button>
          </div>
        </div>

        <LoaderOverlay isLoading={isPending} />
      </div>

      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name your project</DialogTitle>
            <DialogDescription>
              Give this project a name before it is created.
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
                {isPending ? "Creating..." : "Start project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const ACCEPTED_ATTACHMENTS = "application/pdf,image/*,video/*"

function toAttachmentData(attachment: ProjectAttachment) {
  return {
    id: attachment.id,
    type: "file" as const,
    filename: attachment.name,
    mediaType: attachment.type,
    url: attachment.preview ?? "",
  }
}

function AttachmentStack({
  attachments,
  onRemove,
}: {
  attachments: Array<ProjectAttachment>
  onRemove: (id: string) => void
}) {
  return (
    <Attachments
      variant="grid"
      className="group/stack ml-0! w-auto flex-nowrap gap-0"
    >
      {attachments.map((attachment, index) => {
        const data = toAttachmentData(attachment)
        const mediaCategory = getMediaCategory(data)
        const label = getAttachmentLabel(data)

        return (
          <AttachmentHoverCard key={attachment.id}>
            <AttachmentHoverCardTrigger asChild>
              <Attachment
                data={data}
                onRemove={() => onRemove(attachment.id)}
                className={cn(
                  "size-10 rounded-lg border border-white/15 bg-muted transition-[margin] duration-200",
                  index > 0 && "-ml-3 group-hover/stack:ml-1",
                )}
                style={{ zIndex: attachments.length - index }}
              >
                <AttachmentPreview />
                <AttachmentRemove className="top-0.5 right-0.5 size-4" />
              </Attachment>
            </AttachmentHoverCardTrigger>
            <AttachmentHoverCardContent>
              <div className="space-y-3">
                {mediaCategory === "image" && data.url ? (
                  <div className="flex max-h-80 w-64 items-center justify-center overflow-hidden rounded-md border">
                    <img
                      alt={label}
                      className="max-h-full max-w-full object-contain"
                      src={data.url}
                    />
                  </div>
                ) : null}
                {mediaCategory === "video" && data.url ? (
                  <video
                    className="max-h-80 w-64 rounded-md border object-contain"
                    controls
                    muted
                    src={data.url}
                  />
                ) : null}
                <div className="space-y-1 px-0.5">
                  <h4 className="text-sm leading-none font-semibold">
                    {label}
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground">
                    {attachment.type}
                  </p>
                </div>
              </div>
            </AttachmentHoverCardContent>
          </AttachmentHoverCard>
        )
      })}
    </Attachments>
  )
}

function AddAttachment({
  onFilesAdded,
  onError,
}: {
  onFilesAdded: (attachments: Array<ProjectAttachment>) => void
  onError: (message: string) => void
}) {
  const [_state, { openFileDialog, getInputProps }] = useFileUpload({
    multiple: true,
    accept: ACCEPTED_ATTACHMENTS,
    onFilesAdded: (files) => {
      onFilesAdded(
        files.flatMap((item) => {
          if (!(item.file instanceof File)) return []
          return [
            {
              id: item.id,
              name: item.file.name,
              type: item.file.type,
              preview: item.preview,
              file: item.file,
            },
          ]
        }),
      )
    },
    onError,
  })

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0 rounded-lg border-white/15 bg-card! text-muted-foreground hover:scale-105 transition-transform duration-200 cursor-pointer"
        onClick={openFileDialog}
        aria-label="Attach PDF, image, or video"
      >
        <IconPlus className="size-4 text-foreground" />
      </Button>
      <input {...getInputProps()} className="sr-only" />
    </>
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

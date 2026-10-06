import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
import { ChevronDown } from "lucide-react"
import {
  IconCircleChevronRightFilled,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { DotsLoader } from "@sohizi/ui/loaders"
import { Badge } from "@sohizi/ui/badge"
import { Button } from "@sohizi/ui/button"
import { useRef } from "react"
import { createProjectMutationOptions } from "../query-mutation"
import { createProjectSchema } from "../schema"
import { PROJECT_MODES, useNewProjectStore } from "../store/new-project-store"
import DropMenuSettings from "./drop-menu-settings"
import NewProjectSelectModel from "./new-project-select-model"
import NewProjectSettings, {
  PROJECT_SETTING_META,
} from "./new-project-settings"
import StoryIdeaEditor from "./story-idea-editor"
import type { ProjectAttachment, ProjectMode } from "../store/new-project-store"
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
    duration,
    validate,
    modelId,
    mode,
    setMode,
    clearAdditionalSetting,
    attachments,
    addAttachments,
    removeAttachment,
  } = useNewProjectStore()

  const { mutate: createProject, isPending } = useMutation(
    createProjectMutationOptions,
  )
  const navigate = useNavigate()

  const editorRef = useRef<Editor>(null)

  const onSubmit = () => {
    const { valid, errors } = validate()
    if (!valid) {
      errors.forEach((error) => {
        toast.error(error)
      })
      return
    }
    const { format, ...restAdditionalSettings } = additionalSettings
    const payload = {
      brief: {
        format: format?.value ?? "",
        durationMin: duration,
        storyIdea,
      },
      additionalSettings: restAdditionalSettings,
      modelId,
    }
    const output = createProjectSchema.safeParse(payload)
    if (!output.success) {
      let errorMessage = ""
      for (const [_, value] of Object.entries(output.error.issues)) {
        errorMessage += value.path.join(".") + ": " + value.message + "\n\n"
      }
      toast.error(errorMessage)
      return
    }

    createProject(output.data, {
      onSuccess: async (response) => {
        captureAnalyticsEvent("project_created", {
          project_id: response.id,
          mode: "guided",
        })
        await navigate({
          to: "/projects/$projectId/editor",
          params: {
            projectId: response.id,
          },
        })
      },
    })
  }

  const selectedSettings = PROJECT_SETTING_META.flatMap((setting) => {
    const value = additionalSettings[setting.storeKey]
    if (!value) return []
    return [{ ...setting, value }]
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

  const selectedMode =
    PROJECT_MODES.find((option) => option.value === mode) ?? PROJECT_MODES[0]

  return (
    <div className="space-y-3">
      {selectedSettings.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selectedSettings.map((setting) => (
            <Badge
              key={setting.storeKey}
              variant="secondary"
              className="gap-1.5 rounded-full border-white/10 bg-white/5 px-3 py-1.5 pr-2 text-xs text-slate-400"
            >
              {setting.label}: {setting.value.label}
              <button
                type="button"
                aria-label={`Remove ${setting.label}`}
                className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                onClick={() => clearAdditionalSetting(setting.storeKey)}
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div
        className="h-fit rounded-3xl border border-white/10 bg-white/5 p-4 focus-within:ring-2 focus-within:ring-primary/20"
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
          <div className="max-h-45 min-w-0 w-full flex-1 overflow-y-auto">
            <StoryIdeaEditor
              onChange={setStoryIdea}
              onSubmit={onSubmit}
              ref={(editor) => (editorRef.current = editor)}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DropMenuSettings
              options={PROJECT_MODES.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              onSelect={(value) => setMode(value as ProjectMode)}
            >
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/5"
              >
                <span className="max-w-50 truncate">{selectedMode.label}</span>
                <ChevronDown className="size-4 opacity-50" />
              </button>
            </DropMenuSettings>
            <NewProjectSettings />
          </div>

          <div className="flex items-center gap-2">
            <NewProjectSelectModel />
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold"
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
        className="size-10 shrink-0 rounded-lg border-white/15 bg-transparent text-muted-foreground hover:bg-white/5"
        onClick={openFileDialog}
        aria-label="Attach PDF, image, or video"
      >
        <IconPlus className="size-4" />
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

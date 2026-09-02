import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import {
  RENDER_CONTRACT_VERSION,
  RENDER_LIMITS,
} from "@sohizi/video-composition"
import { useVideoEditorStore } from "../store/editor-store"
import { useVideoEditorUiStore } from "../store/ui-store"
import {
  cancelRenderMutationOptions,
  createRenderMutationOptions,
  renderQueryOptions,
} from "../query-mutations"
import { getRenderDownload } from "../requests"
import type { RenderCompositionInput } from "@sohizi/video-composition"
import type { RenderJob } from "../requests"

/**
 * Export submits the exact in-memory state the Remotion Player previews, so it
 * never has to wait for the autosave debounce, and then polls the server-owned
 * render job until the MP4 can be downloaded.
 */

const DEFAULT_FILE_NAME = "video"

function takeRenderSnapshot(): RenderCompositionInput {
  const s = useVideoEditorStore.getState()
  return {
    fps: s.fps,
    width: s.width,
    height: s.height,
    durationInFrames: s.durationInFrames,
    tracks: structuredClone(s.tracks),
  }
}

/** Matches the `fileName` pattern the render service accepts. */
function toRenderFileName(name: string): string {
  const base = (name || DEFAULT_FILE_NAME)
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w \-.]+/g, "-")
    .trim()
    .slice(0, 100)

  return `${base || DEFAULT_FILE_NAME}.mp4`
}

function toMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.error === "string") {
    return error.response.data.error
  }
  return error instanceof Error ? error.message : fallback
}

function isRunning(job: RenderJob | undefined): boolean {
  return job?.status === "queued" || job?.status === "rendering"
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export type VideoExportState = {
  job: RenderJob | undefined
  isSubmitting: boolean
  isCancelling: boolean
  isDownloading: boolean
  isBusy: boolean
  canExport: boolean
  start: (fileName?: string) => Promise<void>
  cancel: () => Promise<void>
  download: () => Promise<void>
  dismiss: () => void
}

export function useVideoExport(): VideoExportState {
  const queryClient = useQueryClient()
  const projectId = useVideoEditorStore((s) => s.projectId)
  const compositionId = useVideoEditorStore((s) => s.compositionId)
  const activeRender = useVideoEditorUiStore((s) => s.activeRender)
  const setActiveRender = useVideoEditorUiStore((s) => s.setActiveRender)

  const renderJobId =
    activeRender && activeRender.compositionId === compositionId
      ? activeRender.jobId
      : null

  const { data: job } = useQuery(
    renderQueryOptions(projectId ?? "", renderJobId),
  )

  const { mutateAsync: submitRender, isPending: isSubmitting } = useMutation(
    createRenderMutationOptions(projectId ?? "", compositionId ?? ""),
  )
  const { mutateAsync: submitCancel, isPending: isCancelling } = useMutation(
    cancelRenderMutationOptions(projectId ?? ""),
  )
  const [isDownloading, setIsDownloading] = useState(false)
  const notifiedStatusRef = useRef<RenderJob["status"] | null>(null)

  const cacheJob = useCallback(
    (next: RenderJob) => {
      if (!projectId) return
      queryClient.setQueryData(
        renderQueryOptions(projectId, next.id).queryKey,
        next,
      )
    },
    [projectId, queryClient],
  )

  // Announce each terminal state once, even while the component stays mounted.
  useEffect(() => {
    if (!job || notifiedStatusRef.current === job.status) return
    notifiedStatusRef.current = job.status

    if (job.status === "completed")
      toast.success("Your video is ready to download")
    if (job.status === "failed") {
      toast.error(job.error?.message ?? "The export failed. Please try again.")
    }
  }, [job])

  const start = useCallback(
    async (fileName?: string) => {
      if (!projectId || !compositionId) return
      if (isSubmitting || isRunning(job)) return

      const composition = takeRenderSnapshot()
      if (composition.tracks.every((track) => track.clips.length === 0)) {
        toast.error("Add something to the timeline before exporting.")
        return
      }
      if (composition.durationInFrames > RENDER_LIMITS.maxDurationInFrames) {
        toast.error("This video is too long to export.")
        return
      }

      try {
        const created = await submitRender({
          contractVersion: RENDER_CONTRACT_VERSION,
          fileName: toRenderFileName(fileName ?? DEFAULT_FILE_NAME),
          composition,
        })
        notifiedStatusRef.current = null
        cacheJob(created)
        setActiveRender({ compositionId, jobId: created.id })
      } catch (error) {
        toast.error(toMessage(error, "Could not start the export."))
      }
    },
    [
      cacheJob,
      compositionId,
      isSubmitting,
      job,
      projectId,
      setActiveRender,
      submitRender,
    ],
  )

  const cancel = useCallback(async () => {
    if (!renderJobId || isCancelling) return
    try {
      cacheJob(await submitCancel(renderJobId))
      toast.info("Export cancelled")
    } catch (error) {
      toast.error(toMessage(error, "Could not cancel the export."))
    }
  }, [cacheJob, isCancelling, renderJobId, submitCancel])

  const download = useCallback(async () => {
    if (!projectId || !renderJobId || isDownloading) return
    setIsDownloading(true)
    try {
      const { url, fileName } = await getRenderDownload(projectId, renderJobId)
      triggerDownload(url, fileName)
    } catch (error) {
      toast.error(toMessage(error, "Could not download the video."))
    } finally {
      setIsDownloading(false)
    }
  }, [isDownloading, projectId, renderJobId])

  const dismiss = useCallback(() => setActiveRender(null), [setActiveRender])

  return {
    job,
    isSubmitting,
    isCancelling,
    isDownloading,
    isBusy: isSubmitting || isRunning(job),
    canExport: !!projectId && !!compositionId,
    start,
    cancel,
    download,
    dismiss,
  }
}

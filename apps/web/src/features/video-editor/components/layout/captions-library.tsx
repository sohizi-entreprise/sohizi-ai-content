import { useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Sparkles, Subtitles } from "lucide-react"
import { toast } from "sonner"
import { useVideoEditorStore } from "../../store/editor-store"
import { useSelectedClip } from "../../hooks/use-selected-clip"
import { generateCaptionMutationOptions } from "../../query-mutations"
import { formatPlayerTimecode, framesToSeconds } from "../../utils/time"
import type { CaptionClip } from "../../store/types"
import { Button } from "@sohizi/ui/button"
import { cn } from "@/lib/utils"

interface CaptionsLibraryProps {
  projectId: string
}

export function CaptionsLibrary({ projectId }: CaptionsLibraryProps) {
  const tracks = useVideoEditorStore((s) => s.tracks)
  const fps = useVideoEditorStore((s) => s.fps)
  const selectClip = useVideoEditorStore((s) => s.selectClip)
  const seekToFrame = useVideoEditorStore((s) => s.seekToFrame)
  const selectedClip = useSelectedClip()

  const { mutate: generateCaption, isPending } = useMutation(
    generateCaptionMutationOptions(projectId),
  )

  const captionClips = useMemo(() => {
    const list: Array<CaptionClip> = []
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.type === "caption") list.push(clip)
      }
    }
    return list.sort((a, b) => a.startFrame - b.startFrame)
  }, [tracks])

  const canGenerate =
    selectedClip?.type === "video" || selectedClip?.type === "audio"

  const handleGenerate = () => {
    if (!selectedClip) return
    generateCaption(selectedClip.trackId, {
      onSuccess: () => {
        toast.success("Captions generated. Reopen this video to load them.")
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <>
      <div className="shrink-0 px-3.5 pt-3.5 pb-3">
        <h2 className="text-sm font-medium text-foreground">Captions</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Transcribe and review your dialogue
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3.5">
        <div className="mb-3 shrink-0 border-b border-border/40 pb-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {canGenerate
                ? "Generate word-level captions from the selected clip."
                : "Select a video or audio clip to generate captions."}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2.5 h-7 gap-1.5 rounded-md px-2.5 text-xs font-medium"
            disabled={!canGenerate || isPending}
            onClick={handleGenerate}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Generate captions
          </Button>
        </div>

        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            In this composition
          </p>
          {captionClips.length > 0 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {captionClips.length}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {captionClips.length === 0 ? (
            <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 px-4 text-center">
              <Subtitles className="size-4 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">No captions yet</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {captionClips.map((clip, index) => {
                const isSelected = selectedClip?.id === clip.id
                return (
                  <li key={clip.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectClip(clip.id)
                        seekToFrame(clip.startFrame)
                      }}
                      className={cn(
                        "flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        "hover:bg-muted/70",
                        isSelected && "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 w-5 shrink-0 text-[11px] tabular-nums",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-xs leading-snug text-foreground">
                          {clip.captions.text || "Caption"}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground">
                          {formatPlayerTimecode(clip.startFrame, fps)} ·{" "}
                          {framesToSeconds(
                            clip.endFrame - clip.startFrame,
                            fps,
                          ).toFixed(1)}
                          s
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

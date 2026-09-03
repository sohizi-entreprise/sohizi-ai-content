import { useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import { Label } from "@sohizi/ui/label"
import { Switch } from "@sohizi/ui/switch"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { getPromptPlaceholder, showsAgentMode } from "../constants"
import type { Editor } from "@tiptap/core"
import { cn } from "@/lib/utils"
import ChatTextarea from "@/features/chat/components/chat-textarea"

export type MediaChatInputProps = {
  projectId: string
  className?: string
  handleSendRequest: () => void
  isPending: boolean
  disableButton: boolean
}

export function MediaChatInput({
  projectId,
  className,
  handleSendRequest,
  isPending,
  disableButton,
}: MediaChatInputProps) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore(
    (state) => state.generationSubtype,
  )
  const setChatInput = useMediaGeneratorStore((state) => state.setChatInput)
  const setPrompt = useMediaGeneratorStore((state) => state.setPrompt)
  const runMode = useMediaGeneratorStore((state) => state.runMode)
  const setRunMode = useMediaGeneratorStore((state) => state.setRunMode)
  const editorRef = useRef<Editor | null>(null)

  useEffect(() => {
    if (editorRef.current) {
      setChatInput(editorRef.current)
    }
    return () => {
      setChatInput(null)
    }
  }, [editorRef.current, setChatInput])

  return (
    <section className={cn("relative", className)}>
      <div className="relative z-1">
        <div className="max-h-28 min-h-20 min-w-0 overflow-y-auto rounded-xl p-3 border bg-background focus-within:border-white/20 text-foreground">
          <ChatTextarea
            projectId={projectId}
            onChange={setPrompt}
            placeholder={getPromptPlaceholder(
              generationType,
              generationSubtype,
            )}
            editorRef={editorRef}
          />
        </div>

        {showsAgentMode(generationType) ? (
          <div className="flex items-center justify-between gap-3 px-1 py-2">
            <Label
              htmlFor="media-run-mode"
              className="text-xs text-muted-foreground"
            >
              Agent mode
            </Label>
            <Switch
              id="media-run-mode"
              checked={runMode === "agent"}
              onCheckedChange={(checked) =>
                setRunMode(checked ? "agent" : "direct")
              }
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2 py-2">
          <Button
            disabled={disableButton}
            onClick={handleSendRequest}
            className={cn(
              "h-11 w-full rounded-xl text-black disabled:opacity-50",
              isPending && "animate-pulse",
            )}
          >
            <Sparkles className="size-4" />
            {isPending ? "Pending…" : "Generate"}
          </Button>
        </div>
      </div>
    </section>
  )
}

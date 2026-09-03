import { useState } from "react"
import { toast } from "sonner"
import { isValidYoutubeUrl } from "../../extensions/youtube-embed"
import type { Editor } from "@tiptap/core"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Button } from "@sohizi/ui/button"

type YoutubeEmbedDialogProps = {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function YoutubeEmbedDialog({
  editor,
  open,
  onOpenChange,
}: YoutubeEmbedDialogProps) {
  const [url, setUrl] = useState("")

  const handleEmbed = () => {
    const trimmed = url.trim()
    if (!trimmed) return

    if (!isValidYoutubeUrl(trimmed)) {
      toast.error("Please enter a valid YouTube URL")
      return
    }

    const success = editor
      .chain()
      .focus()
      .setYoutubeVideo({ src: trimmed })
      .run()
    if (!success) {
      toast.error("Could not embed this YouTube video")
      return
    }

    setUrl("")
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setUrl("")
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Embed YouTube video</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="youtube-url">YouTube URL</Label>
          <Input
            id="youtube-url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleEmbed()
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleEmbed}
            disabled={!url.trim()}
          >
            Embed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

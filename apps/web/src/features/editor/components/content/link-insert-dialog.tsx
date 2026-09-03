import { useEffect, useState } from "react"
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

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

type LinkInsertDialogProps = {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
  initialHref?: string
  hasLink?: boolean
}

export function LinkInsertDialog({
  editor,
  open,
  onOpenChange,
  initialHref = "",
  hasLink = false,
}: LinkInsertDialogProps) {
  const [url, setUrl] = useState(initialHref)

  useEffect(() => {
    if (open) {
      setUrl(initialHref)
    }
  }, [open, initialHref])

  const handleApply = () => {
    const href = normalizeUrl(url)
    if (!href) return

    const { empty, to } = editor.state.selection
    if (empty) return

    editor
      .chain()
      .focus()
      .setLink({ href })
      .setTextSelection(to)
      .unsetMark("link")
      .run()

    onOpenChange(false)
  }

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="link-url">URL</Label>
          <Input
            id="link-url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleApply()
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {hasLink && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
            >
              Remove link
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!url.trim()}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

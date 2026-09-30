import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@sohizi/ui/sheet"
import type { DiffHunk } from "../../diff-markdown"
import "./markdown-diff-changes-panel.css"

interface MarkdownDiffChangesPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hunks: Array<DiffHunk>
}

export function MarkdownDiffChangesPanel({
  open,
  onOpenChange,
  hunks,
}: MarkdownDiffChangesPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Changes</SheetTitle>
          <SheetDescription className="sr-only">
            Review the pending edits in this document.
          </SheetDescription>
        </SheetHeader>
        <div className="markdown-diff-panel-list min-h-0 flex-1 overflow-auto scrollbar-hide">
          {hunks.length === 0 ? (
            <p className="markdown-diff-panel-empty">No changes to review.</p>
          ) : (
            hunks.map((hunk) => (
              <div key={hunk.id} className="markdown-diff-panel-hunk">
                {hunk.deleted ? (
                  <pre className="markdown-diff-panel-item markdown-diff-panel-item--delete">
                    {hunk.deleted}
                  </pre>
                ) : null}
                {hunk.inserted ? (
                  <pre className="markdown-diff-panel-item markdown-diff-panel-item--insert">
                    {hunk.inserted}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

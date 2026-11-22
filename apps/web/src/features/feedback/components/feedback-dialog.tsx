import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import { Label } from "@sohizi/ui/label"
import { Textarea } from "@sohizi/ui/textarea"
import { submitFeedback } from "../requests"
import type { FeedbackType } from "../requests"
import { cn } from "@/lib/utils"

type FeedbackDialogProps = {
  projectId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FEEDBACK_OPTIONS: ReadonlyArray<{
  type: FeedbackType
  label: string
  description: string
  placeholder: string
}> = [
  {
    type: "issue",
    label: "Report an issue",
    description: "Let us know what went wrong and what you expected to happen.",
    placeholder:
      "Describe the issue you encountered, steps to reproduce it, and what you expected...",
  },
  {
    type: "feature_request",
    label: "Request a feature",
    description:
      "Share an idea or improvement that would make your workflow better.",
    placeholder:
      "Describe the feature or improvement you would like to see and how it would help you...",
  },
]

export function FeedbackDialog({
  projectId,
  open,
  onOpenChange,
}: FeedbackDialogProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType>("issue")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaId = useId()

  useEffect(() => {
    if (!open) return
    setSelectedType("issue")
    setContent("")
  }, [open])

  const activeOption =
    FEEDBACK_OPTIONS.find((option) => option.type === selectedType) ??
    FEEDBACK_OPTIONS[0]

  const trimmedContent = content.trim()
  const canSubmit = trimmedContent.length > 0 && !isSubmitting

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const metadata =
        typeof window !== "undefined"
          ? {
              pageUrl: window.location.href,
              userAgent: window.navigator.userAgent,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
              },
            }
          : undefined

      await submitFeedback({
        type: selectedType,
        content: trimmedContent,
        projectId: projectId ?? null,
        metadata,
      })

      toast.success(
        selectedType === "issue"
          ? "Issue report submitted. Thank you!"
          : "Feature request submitted. Thank you!",
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit feedback",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="grid gap-4"
        >
          <DialogHeader className="gap-3">
            <div className="flex flex-col gap-2">
              <DialogTitle>Send feedback</DialogTitle>
              <div
                role="radiogroup"
                aria-label="Feedback type"
                className="flex flex-wrap items-center gap-2 pt-1"
              >
                {FEEDBACK_OPTIONS.map(({ type, label }) => {
                  const isSelected = selectedType === type
                  return (
                    <Badge
                      key={type}
                      asChild
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer px-2.5 py-1 text-xs transition-colors select-none",
                        isSelected
                          ? "shadow-xs"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedType(type)}
                      >
                        {label}
                      </button>
                    </Badge>
                  )
                })}
              </div>
            </div>
            <DialogDescription>{activeOption.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={textareaId}>
              {selectedType === "issue" ? "Issue details" : "Feature details"}
            </Label>
            <Textarea
              id={textareaId}
              name="content"
              value={content}
              maxLength={5000}
              onChange={(event) => setContent(event.target.value)}
              placeholder={activeOption.placeholder}
              className="w-full min-h-28 max-h-60"
              required
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : selectedType === "issue" ? (
                "Submit issue"
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

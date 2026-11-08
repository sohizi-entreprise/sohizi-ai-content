import { useEffect, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useShallow } from "zustand/shallow"
import { Check, ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { useChatStore } from "../store/chat-store"
import { listAgentRunsInfiniteQueryOptions } from "../query-mutation"
import { useSendMessage } from "../hooks/use-chat"
import {
  extractLatestActiveAskQuestions,
  formatQuestionAnswersMessage,
} from "../lib/ask-questions"
import type {
  ActiveAskQuestionsPrompt,
  QuestionAnswerValue,
} from "../lib/ask-questions"
import { cn } from "@/lib/utils"

export function ChatQuestionDock({ projectId }: { projectId: string }) {
  const conversation = useChatStore(
    useShallow((state) => state.activeConversation),
  )

  if (
    !conversation ||
    conversation.isNew ||
    conversation.projectId !== projectId
  ) {
    return null
  }

  return (
    <ChatQuestionDockInner
      projectId={projectId}
      conversationId={conversation.id}
      isConversationStreaming={Boolean(conversation.isStreaming)}
    />
  )
}

function ChatQuestionDockInner({
  projectId,
  conversationId,
  isConversationStreaming,
}: {
  projectId: string
  conversationId: string
  isConversationStreaming: boolean
}) {
  const { data: runs = [] } = useInfiniteQuery(
    listAgentRunsInfiniteQueryOptions(projectId, conversationId, false),
  )
  const { sendCustomTextMessage, loadingState } = useSendMessage(projectId)
  const [dismissedToolCallIds, setDismissedToolCallIds] = useState<
    Record<string, boolean | undefined>
  >({})

  const activePrompt = extractLatestActiveAskQuestions(runs)

  if (
    !activePrompt ||
    isConversationStreaming ||
    dismissedToolCallIds[activePrompt.toolCallId]
  ) {
    return null
  }

  const handleSubmitPrompt = (
    prompt: ActiveAskQuestionsPrompt,
    answers: Record<string, QuestionAnswerValue | undefined>,
  ) => {
    const formatted = formatQuestionAnswersMessage(prompt.questions, answers)
    sendCustomTextMessage(formatted, {
      onSuccess: () => {
        setDismissedToolCallIds((prev) => ({
          ...prev,
          [prompt.toolCallId]: true,
        }))
      },
    })
  }

  return (
    <QuestionCard
      key={activePrompt.toolCallId}
      prompt={activePrompt}
      isSubmitting={loadingState}
      onSubmit={(answers) => handleSubmitPrompt(activePrompt, answers)}
    />
  )
}

function QuestionCard({
  prompt,
  isSubmitting,
  onSubmit,
}: {
  prompt: ActiveAskQuestionsPrompt
  isSubmitting: boolean
  onSubmit: (answers: Record<string, QuestionAnswerValue | undefined>) => void
}) {
  const { questions } = prompt
  const total = questions.length
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<
    Record<string, QuestionAnswerValue | undefined>
  >({})
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (currentIndex >= total) {
      setCurrentIndex(Math.max(0, total - 1))
    }
  }, [currentIndex, total])

  const currentQuestion = questions.at(currentIndex)
  if (!currentQuestion) return null

  const isFirst = currentIndex === 0
  const isLast = currentIndex === total - 1
  const currentAnswer = answers[currentQuestion.id]
  const customDraft = customDrafts[currentQuestion.id] ?? ""

  const goBack = () => {
    if (!isFirst) {
      setCurrentIndex((idx) => Math.max(0, idx - 1))
    }
  }

  const goForward = () => {
    if (!isLast) {
      setCurrentIndex((idx) => Math.min(total - 1, idx + 1))
    }
  }

  const handleSelectOption = (optionText: string) => {
    if (isSubmitting) return
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { kind: "option", value: optionText },
    }))
    if (!isLast) {
      setCurrentIndex((idx) => Math.min(total - 1, idx + 1))
    }
  }

  const handleCustomInputChange = (value: string) => {
    setCustomDrafts((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }))
    if (value.trim().length > 0) {
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { kind: "custom", value },
      }))
    } else if (currentAnswer?.kind === "custom") {
      setAnswers((prev) => {
        const next = { ...prev }
        delete next[currentQuestion.id]
        return next
      })
    }
  }

  const handleCustomInputConfirm = () => {
    if (isSubmitting) return
    const trimmed = customDraft.trim()
    if (!trimmed) return

    const nextAnswers: Record<string, QuestionAnswerValue | undefined> = {
      ...answers,
      [currentQuestion.id]: { kind: "custom", value: trimmed },
    }
    setAnswers(nextAnswers)

    if (!isLast) {
      setCurrentIndex((idx) => Math.min(total - 1, idx + 1))
    }
  }

  const handleSkip = () => {
    if (isSubmitting) return
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { kind: "skipped" },
    }))
    if (!isLast) {
      setCurrentIndex((idx) => Math.min(total - 1, idx + 1))
    }
  }

  const handleFinalSubmit = () => {
    if (isSubmitting) return
    onSubmit(answers)
  }

  return (
    <div className="px-3 pt-2">
      <div className="rounded-2xl border border-border/80 bg-surface p-3.5 shadow-sm">
        {/* Header: Step counter, navigation arrows, and Skip button */}
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goBack}
              disabled={isFirst || isSubmitting}
              aria-label="Previous question"
              className="size-6 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-35"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              Question {currentIndex + 1} of {total}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goForward}
              disabled={isLast || isSubmitting}
              aria-label="Next question"
              className="size-6 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-35"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSubmitting}
            className={cn(
              "h-6 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground",
              currentAnswer?.kind === "skipped" &&
                "bg-muted/60 text-foreground font-medium",
            )}
          >
            {currentAnswer?.kind === "skipped" ? "Skipped" : "Skip"}
          </Button>
        </div>

        {/* Question text */}
        <p className="mb-3 text-sm font-medium leading-snug text-foreground">
          {currentQuestion.question}
        </p>

        {/* 2 Predefined options */}
        <div className="flex flex-col gap-1.5">
          {currentQuestion.options.map((optionText, idx) => {
            const isSelected =
              currentAnswer?.kind === "option" &&
              currentAnswer.value === optionText

            return (
              <button
                key={`${currentQuestion.id}-opt-${idx}`}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSelectOption(optionText)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "border-primary/60 bg-primary/10 text-foreground font-medium"
                    : "border-border/60 bg-background/60 text-foreground/90 hover:border-border hover:bg-background",
                  isSubmitting && "opacity-60 cursor-not-allowed",
                )}
              >
                <span className="min-w-0 flex-1">{optionText}</span>
                {isSelected ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : null}
              </button>
            )
          })}

          {/* 1 Open-ended custom input */}
          <div className="relative mt-0.5 flex items-center">
            <Input
              value={customDraft}
              disabled={isSubmitting}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleCustomInputConfirm()
                }
              }}
              placeholder="Or type your own preference..."
              className={cn(
                "h-9 rounded-xl border-border/60 bg-background/60 pr-9 text-sm",
                currentAnswer?.kind === "custom" &&
                  "border-primary/60 bg-primary/5",
              )}
            />
            {customDraft.trim().length > 0 && !isLast ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCustomInputConfirm}
                aria-label="Confirm custom answer and next"
                className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <CornerDownLeft className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Final step confirmation footer */}
        {isLast ? (
          <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-2.5">
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="h-7 rounded-lg px-3 text-xs"
            >
              {isSubmitting ? "Submitting..." : "Submit answers"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

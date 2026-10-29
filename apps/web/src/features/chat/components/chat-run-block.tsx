import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { IconAlertCircle, IconCoins } from "@tabler/icons-react"
import { Button } from "@sohizi/ui/button"
import { useBufferChunks } from "../hooks/use-buffer-chunks"
import { classifyRunError } from "../lib/run-error"
import { buildRunPresentation } from "../lib/tool-activity"
import { useChatStore } from "../store/chat-store"
import {
  agentRunsQueryKey,
  conversationsQueryKey,
  updateAgentRunInCache,
} from "../query-mutation"
import ChatBuble from "./chat-buble"
import { ChatRunProvider, useChatRun } from "./chat-run-context"
import { ChatThoughtBlock } from "./chat-thought-block"
import type {
  AgentRunBlock,
  FilePendingOperation,
  Message,
  VideoEditorChange,
} from "../types"
import {
  MessageContent,
  MessageResponse,
  Message as UIMessage,
} from "@/components/ai-elements/message"
import { fileTreeKey } from "@/features/projects/query-mutation"
import { getFilePendingKey } from "@/features/editor/query-mutations"
import { useVideoEditorStore } from "@/features/video-editor/store/editor-store"

export const ChatRunBlock = ({ run }: { run: AgentRunBlock }) => {
  const status = run.status
  const messages = run.messages
  const isCancelled = useChatStore((state) =>
    Boolean(state.cancelledRunIds[run.id]),
  )
  const hasError = !isCancelled && (status === "error" || Boolean(run.error))

  const patchConversation = useChatStore(
    (state) => state.patchActiveConversation,
  )

  useEffect(() => {
    if (status === "finished" || status === "error" || isCancelled) {
      patchConversation({ isStreaming: false })
    } else {
      patchConversation({ isStreaming: true, activeRunId: run.id })
    }
  }, [status, run.id, isCancelled, patchConversation])

  if (status === "pending" || status === "running") {
    return <PendingRunBlock run={run} isCancelled={isCancelled} />
  }

  return (
    <ChatRunProvider runId={run.id} messages={messages}>
      <div className="space-y-3">
        <RenderRunTurn
          messages={messages}
          isRunning={false}
          createdAt={run.createdAt}
          updatedAt={run.updatedAt}
        />
        {hasError ? <ChatRunErrorBanner error={run.error} /> : null}
      </div>
    </ChatRunProvider>
  )
}

function PendingRunBlock({
  run,
  isCancelled,
}: {
  run: AgentRunBlock
  isCancelled: boolean
}) {
  const queryClient = useQueryClient()
  const [isFinished, setIsFinished] = useState(false)
  const [finishedAt, setFinishedAt] = useState<string | undefined>(undefined)

  const onFinish = (_: AgentRunBlock["status"]) => {
    setIsFinished(true)
    setFinishedAt(new Date().toISOString())
  }
  const onOperation = (operation: FilePendingOperation) => {
    const fileId = operation.fileId
    switch (operation.type) {
      case "patch": {
        queryClient.invalidateQueries({
          queryKey: getFilePendingKey(run.projectId, fileId),
        })
        break
      }
      case "refresh": {
        queryClient.invalidateQueries({
          queryKey: fileTreeKey(run.projectId, fileId),
        })
        break
      }
    }
  }

  const onVideoEditorChange = (change: VideoEditorChange) => {
    useVideoEditorStore.getState().applyServerChange(change)
  }

  const onTitleUpdate = () => {
    queryClient.invalidateQueries({
      queryKey: conversationsQueryKey(run.projectId),
    })
  }

  const url = `/api/chats/${run.projectId}/conversations/${run.conversationId}/runs/${run.id}`
  const { messages, error: streamError } = useBufferChunks({
    url,
    initialMessages: run.messages,
    isCancelled,
    onFinish,
    onOperation,
    onVideoEditorChange,
    onTitleUpdate,
  })
  const activeError = isCancelled ? null : (streamError ?? run.error)
  const isRunning = !isFinished && !isCancelled && !activeError

  useEffect(() => {
    if (!isFinished) return
    const updatedAt = finishedAt ?? new Date().toISOString()
    queryClient.setQueryData(
      agentRunsQueryKey(run.projectId, run.conversationId),
      (old: Parameters<typeof updateAgentRunInCache>[0]) =>
        updateAgentRunInCache(old, run.id, {
          status: activeError ? "error" : "finished",
          messages,
          error: activeError ?? null,
          updatedAt,
        }),
    )
  }, [
    isFinished,
    finishedAt,
    activeError,
    messages,
    queryClient,
    run.projectId,
    run.conversationId,
    run.id,
  ])

  return (
    <ChatRunProvider runId={run.id} messages={messages}>
      <div className="space-y-3">
        <RenderRunTurn
          messages={messages}
          isRunning={isRunning}
          createdAt={run.createdAt}
          updatedAt={finishedAt ?? run.updatedAt}
        />
        {activeError ? <ChatRunErrorBanner error={activeError} /> : null}
      </div>
    </ChatRunProvider>
  )
}

function RenderRunTurn({
  messages,
  isRunning,
  createdAt,
  updatedAt,
}: {
  messages: Array<Message>
  isRunning: boolean
  createdAt: string
  updatedAt?: string
}) {
  const { tasks, firstAddToolCallId } = useChatRun()

  const { userMessages, timelineItems, finalResponse } = useMemo(
    () =>
      buildRunPresentation(messages, {
        firstAddToolCallId,
        hasTasks: tasks.length > 0,
      }),
    [messages, firstAddToolCallId, tasks.length],
  )

  const showThoughtBlock = timelineItems.length > 0 || isRunning

  return (
    <div className="flex flex-col gap-4">
      {userMessages.map((msg) => (
        <ChatBuble key={msg.id} data={msg} />
      ))}

      {showThoughtBlock || finalResponse ? (
        <UIMessage from="assistant">
          <MessageContent className="w-full gap-3">
            {showThoughtBlock ? (
              <ChatThoughtBlock
                timelineItems={timelineItems}
                isRunning={isRunning}
                createdAt={createdAt}
                updatedAt={updatedAt}
                hasFinalResponse={Boolean(finalResponse)}
              />
            ) : null}

            {finalResponse ? (
              <MessageResponse isAnimating={finalResponse.isStreaming}>
                {finalResponse.text}
              </MessageResponse>
            ) : null}
          </MessageContent>
        </UIMessage>
      ) : null}
    </div>
  )
}

function ChatRunErrorBanner({ error }: { error: string | null | undefined }) {
  const classified = classifyRunError(error)

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
    >
      <div className="flex items-start gap-2">
        <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{classified.message}</span>
      </div>
      {classified.kind === "billing" ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 rounded-full border-destructive/30 bg-background/60 px-3 text-xs text-foreground hover:bg-background"
        >
          <Link to={classified.billingPath}>
            <IconCoins className="size-3.5" />
            Manage billing
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

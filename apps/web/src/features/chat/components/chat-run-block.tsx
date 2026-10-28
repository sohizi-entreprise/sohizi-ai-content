import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { IconAlertCircle, IconCoins } from "@tabler/icons-react"
import { TextShimmerCss } from "@sohizi/ui/loaders"
import { Button } from "@sohizi/ui/button"
import { useBufferChunks } from "../hooks/use-buffer-chunks"
import { classifyRunError } from "../lib/run-error"
import { useChatStore } from "../store/chat-store"
import ChatBuble from "./chat-buble"
import { ChatRunProvider } from "./chat-run-context"
import type { AgentRunBlock, FilePendingOperation, Message } from "../types"
import { fileTreeKey } from "@/features/projects/query-mutation"
import { getFilePendingKey } from "@/features/editor/query-mutations"

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
        <RenderMessages messages={messages} />
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
  const onFinish = (_: AgentRunBlock["status"]) => {
    setIsFinished(true)
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

  const url = `/api/chats/${run.projectId}/conversations/${run.conversationId}/runs/${run.id}`
  const { messages, error: streamError } = useBufferChunks({
    url,
    initialMessages: run.messages,
    isCancelled,
    onFinish,
    onOperation,
  })
  const activeError = isCancelled ? null : (streamError ?? run.error)

  return (
    <ChatRunProvider runId={run.id} messages={messages}>
      <div className="space-y-3">
        <RenderMessages messages={messages} />
        {!isFinished && !isCancelled && !activeError && (
          <TextShimmerCss text="Processing..." />
        )}
        {activeError ? <ChatRunErrorBanner error={activeError} /> : null}
      </div>
    </ChatRunProvider>
  )
}

function RenderMessages({ messages }: { messages: Array<Message> }) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => (
        <ChatBuble key={msg.id} data={msg} />
      ))}
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

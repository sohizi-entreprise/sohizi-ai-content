import { createContext, useContext, useMemo, useState } from "react"
import { reduceManageTasks } from "../lib/reduce-manage-tasks"
import type { ReactNode } from "react"
import type { Task } from "../lib/reduce-manage-tasks"
import type { Message } from "../types"

type ChatRunContextValue = {
  artifacts: Record<string, unknown>
  putArtifact: (key: string, value: unknown) => void
  removeArtifact: (key: string) => void
  getArtifact: {
    <T>(key: string, defaultValue: T): T
    <T = unknown>(key: string): T | undefined
  }
  runId: string
  tasks: Array<Task>
  firstAddToolCallId: string | null
}

const ChatRunContext = createContext<ChatRunContextValue | undefined>(undefined)

export const ChatRunProvider = ({
  runId,
  messages,
  children,
}: {
  runId: string
  messages: Array<Message>
  children: ReactNode
}) => {
  const [artifacts, setArtifacts] = useState<Record<string, unknown>>({})
  const { tasks, firstAddToolCallId } = useMemo(
    () => reduceManageTasks(messages),
    [messages],
  )
  const putArtifact = (key: string, value: unknown) => {
    setArtifacts((prev) => ({ ...prev, [key]: value }))
  }
  const removeArtifact = (key: string) => {
    setArtifacts((prev) => {
      const { [key]: _, ...rest } = prev
      return rest
    })
  }
  function getArtifact<T>(key: string, defaultValue?: T): T | undefined {
    if (Object.hasOwn(artifacts, key)) {
      return artifacts[key] as T
    }
    return defaultValue
  }

  return (
    <ChatRunContext.Provider
      value={{
        artifacts,
        putArtifact,
        removeArtifact,
        getArtifact,
        runId,
        tasks,
        firstAddToolCallId,
      }}
    >
      {children}
    </ChatRunContext.Provider>
  )
}

export const useChatRun = () => {
  const context = useContext(ChatRunContext)
  if (!context) {
    throw new Error("useChatRun must be used within a ChatRunProvider")
  }
  return context
}

import type { Message } from "../types"

export type TaskStatus = "pending" | "in_progress" | "done" | "deleted"

export type Task = {
  id: string
  task: string
  status: TaskStatus
}

export type ManageTasksState = {
  tasks: Array<Task>
  firstAddToolCallId: string | null
}

const TASK_STATUSES = new Set<TaskStatus>([
  "pending",
  "in_progress",
  "done",
  "deleted",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getManageTask(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)) return null
  const manageTask = input.manageTask
  if (!isRecord(manageTask) || typeof manageTask.action !== "string") {
    return null
  }
  return manageTask
}

export function reduceManageTasks(messages: Array<Message>): ManageTasksState {
  let tasks: Array<Task> = []
  let firstAddToolCallId: string | null = null

  for (const message of messages) {
    if (message.role !== "assistant") continue

    for (const part of message.content) {
      if (part.type !== "tool-call" || part.toolName !== "manageTasks") {
        continue
      }

      const action = getManageTask(part.input)
      if (!action) continue

      switch (action.action) {
        case "add": {
          if (firstAddToolCallId === null) {
            firstAddToolCallId = part.toolCallId
          }
          if (!Array.isArray(action.tasks)) break

          const additions: Array<Task> = []
          for (const item of action.tasks) {
            if (!isRecord(item)) continue
            if (typeof item.id !== "string" || typeof item.task !== "string") {
              continue
            }
            if (!item.id || !item.task) continue
            additions.push({
              id: item.id,
              task: item.task,
              status: "pending",
            })
          }
          if (additions.length > 0) {
            tasks = [...tasks, ...additions]
          }
          break
        }
        case "update": {
          if (typeof action.taskId !== "string" || !action.taskId) break
          if (
            typeof action.status !== "string" ||
            !TASK_STATUSES.has(action.status as TaskStatus)
          ) {
            break
          }
          const status = action.status as TaskStatus
          const taskId = action.taskId
          tasks = tasks.map((task) =>
            task.id === taskId ? { ...task, status } : task,
          )
          break
        }
        case "delete": {
          if (typeof action.taskId !== "string" || !action.taskId) break
          const taskId = action.taskId
          tasks = tasks.map((task) =>
            task.id === taskId ? { ...task, status: "deleted" as const } : task,
          )
          break
        }
        case "clear": {
          tasks = tasks.map((task) =>
            task.status === "deleted" ? task : { ...task, status: "done" },
          )
          break
        }
      }
    }
  }

  return { tasks, firstAddToolCallId }
}

import { describe, expect, it } from "vitest"
import { reduceManageTasks } from "./reduce-manage-tasks"
import type { Message, MsgToolCallPart } from "../types"

function manageTaskCall(toolCallId: string, input: unknown): MsgToolCallPart {
  return {
    type: "tool-call",
    toolName: "manageTasks",
    toolCallId,
    input,
  }
}

function assistantMessage(...parts: Array<MsgToolCallPart>): Message {
  return {
    id: "msg-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    role: "assistant",
    content: parts,
  }
}

describe("reduceManageTasks", () => {
  it("ignores a streaming add with no tasks array", () => {
    const result = reduceManageTasks([
      assistantMessage(
        manageTaskCall("add-1", { manageTask: { action: "add" } }),
      ),
    ])

    expect(result.tasks).toEqual([])
    expect(result.firstAddToolCallId).toBe("add-1")
  })

  it("skips incomplete task objects in a partial add payload", () => {
    const result = reduceManageTasks([
      assistantMessage(
        manageTaskCall("add-1", {
          manageTask: {
            action: "add",
            tasks: [{ id: "task_1" }, { id: "task_2", task: "Write outline" }],
          },
        }),
      ),
    ])

    expect(result.tasks).toEqual([
      { id: "task_2", task: "Write outline", status: "pending" },
    ])
  })

  it("appends later adds and keeps updates instead of resetting to pending", () => {
    const result = reduceManageTasks([
      assistantMessage(
        manageTaskCall("add-1", {
          manageTask: {
            action: "add",
            tasks: [{ id: "task_1", task: "Write outline" }],
          },
        }),
        manageTaskCall("update-1", {
          manageTask: {
            action: "update",
            taskId: "task_1",
            status: "in_progress",
          },
        }),
        manageTaskCall("add-2", {
          manageTask: {
            action: "add",
            tasks: [{ id: "task_2", task: "Draft scenes" }],
          },
        }),
      ),
    ])

    expect(result.firstAddToolCallId).toBe("add-1")
    expect(result.tasks).toEqual([
      { id: "task_1", task: "Write outline", status: "in_progress" },
      { id: "task_2", task: "Draft scenes", status: "pending" },
    ])
  })

  it("marks deleted and clear without dropping the first add id", () => {
    const result = reduceManageTasks([
      assistantMessage(
        manageTaskCall("add-1", {
          manageTask: {
            action: "add",
            tasks: [
              { id: "task_1", task: "Write outline" },
              { id: "task_2", task: "Draft scenes" },
            ],
          },
        }),
        manageTaskCall("delete-1", {
          manageTask: { action: "delete", taskId: "task_2" },
        }),
        manageTaskCall("clear-1", { manageTask: { action: "clear" } }),
      ),
    ])

    expect(result.firstAddToolCallId).toBe("add-1")
    expect(result.tasks).toEqual([
      { id: "task_1", task: "Write outline", status: "done" },
      { id: "task_2", task: "Draft scenes", status: "deleted" },
    ])
  })
})

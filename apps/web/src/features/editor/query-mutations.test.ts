import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import {
  getFilePendingKey,
  markPendingOperationApplied,
} from "./query-mutations"
import type { PendingFileOperation } from "./types"

describe("markPendingOperationApplied", () => {
  it("does not mark a newer proposal applied when an older save completes", () => {
    const client = new QueryClient()
    const operation: PendingFileOperation = {
      id: "pending-1",
      fileNodeId: "file-1",
      operation: "patch",
      payload: {
        type: "patch",
        content: "second edit",
        fileId: "file-1",
        fileName: "notes",
      },
      diffApplied: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
    }
    const key = getFilePendingKey("project-1", "file-1")
    client.setQueryData(key, { operation })

    markPendingOperationApplied(client, "project-1", "file-1", "first edit")
    expect(
      client.getQueryData<{ operation: PendingFileOperation }>(key),
    ).toEqual({
      operation,
    })

    markPendingOperationApplied(client, "project-1", "file-1", "second edit")
    expect(
      client.getQueryData<{ operation: PendingFileOperation }>(key)?.operation
        .diffApplied,
    ).toBe(true)
  })
})

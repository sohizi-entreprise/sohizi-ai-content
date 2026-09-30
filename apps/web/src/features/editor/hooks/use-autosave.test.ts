// @vitest-environment jsdom
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getFileContentQueryOptions } from "../query-mutations"
import { useEditorStore } from "../stores/editor-store"
import { useAutoSave, useSkillAutosave } from "./use-autosave"
import type { PropsWithChildren } from "react"
import type { Skill } from "../types"

const requests = vi.hoisted(() => ({
  saveFileContent: vi.fn(),
  saveSkill: vi.fn(),
}))

vi.mock("../requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../requests")>()
  return {
    ...actual,
    saveFileContent: requests.saveFileContent,
    saveSkill: requests.saveSkill,
  }
})

const PROJECT_ID = "project-1"
const FILE_A = "file-a"
const FILE_B = "file-b"
const DURATION = 2000

let queryClient: QueryClient

function wrapper({ children }: PropsWithChildren) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    name: "Skill",
    description: "desc",
    instructions: "inst",
    fileNodeId: FILE_A,
    status: "draft",
    visibility: "private",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function savingStatusFor(fileId: string) {
  return useEditorStore.getState().savingStatus[fileId]
}

function contentCacheFor(fileId: string) {
  return queryClient.getQueryData(
    getFileContentQueryOptions(PROJECT_ID, fileId).queryKey,
  )
}

describe("useAutoSave / useSkillAutosave", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    requests.saveFileContent.mockImplementation(
      (_projectId: string, _fileId: string, content: string) =>
        Promise.resolve({ content, revision: 2 }),
    )
    requests.saveSkill.mockResolvedValue(skill())
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    useEditorStore.setState({ savingStatus: {}, lastSavedAt: {} })
  })

  afterEach(() => {
    cleanup()
    queryClient.clear()
    vi.useRealTimers()
  })

  it("waits for the debounce duration before saving while mounted", async () => {
    const { result } = renderHook(
      () =>
        useAutoSave({
          duration: DURATION,
          projectId: PROJECT_ID,
          fileId: FILE_A,
        }),
      { wrapper },
    )

    act(() => result.current({ content: "hello" }))
    expect(savingStatusFor(FILE_A)).toBe("saving")

    await act(async () => {
      vi.advanceTimersByTime(DURATION - 1)
    })
    expect(requests.saveFileContent).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(requests.saveFileContent).toHaveBeenCalledTimes(1)
    expect(requests.saveFileContent).toHaveBeenCalledWith(
      PROJECT_ID,
      FILE_A,
      "hello",
      undefined,
    )
    expect(savingStatusFor(FILE_A)).toBe("saved")
  })

  it("flushes pending content on unmount, before the debounce fires", async () => {
    const { result, unmount } = renderHook(
      () =>
        useAutoSave({
          duration: DURATION,
          projectId: PROJECT_ID,
          fileId: FILE_A,
        }),
      { wrapper },
    )

    act(() => result.current({ content: "unsaved edit" }))
    expect(requests.saveFileContent).not.toHaveBeenCalled()

    await act(async () => {
      unmount()
    })

    expect(requests.saveFileContent).toHaveBeenCalledWith(
      PROJECT_ID,
      FILE_A,
      "unsaved edit",
      undefined,
    )
    expect(contentCacheFor(FILE_A)).toMatchObject({
      type: "markdown",
      content: "unsaved edit",
    })
    expect(savingStatusFor(FILE_A)).toBe("saved")
  })

  it("saves skill body as file content and keeps the skill cache type", async () => {
    queryClient.setQueryData(
      getFileContentQueryOptions(PROJECT_ID, FILE_A).queryKey,
      {
        type: "skill",
        id: FILE_A,
        name: "my-skill",
        path: "/root/core/skills/my-skill",
        content: '---\ndescription: ""\n---\n',
        revision: 1,
        updatedAt: new Date().toISOString(),
        status: "draft",
        visibility: "private",
      },
    )

    const { result } = renderHook(
      () =>
        useAutoSave({
          duration: DURATION,
          projectId: PROJECT_ID,
          fileId: FILE_A,
        }),
      { wrapper },
    )

    const next =
      "---\ndescription: |\n  Use this skill.\n---\nFollow the steps."
    act(() => result.current({ content: next }))
    await act(async () => {
      vi.advanceTimersByTime(DURATION)
    })

    expect(requests.saveFileContent).toHaveBeenCalledWith(
      PROJECT_ID,
      FILE_A,
      next,
      undefined,
    )
    expect(contentCacheFor(FILE_A)).toMatchObject({
      type: "skill",
      content: next,
      status: "draft",
    })
  })

  it("resolves the deferred skill getter on unmount instead of dropping it", async () => {
    const { result, unmount } = renderHook(
      () =>
        useSkillAutosave({
          duration: DURATION,
          projectId: PROJECT_ID,
          fileId: FILE_A,
        }),
      { wrapper },
    )

    const getter = vi.fn(() => ({
      description: "new description",
      instructions: "new instructions",
    }))
    act(() => result.current(getter))
    // Serialization is deferred until the save actually runs.
    expect(getter).not.toHaveBeenCalled()

    await act(async () => {
      unmount()
    })

    expect(getter).toHaveBeenCalledTimes(1)
    expect(requests.saveSkill).toHaveBeenCalledWith(PROJECT_ID, FILE_A, {
      description: "new description",
      instructions: "new instructions",
    })
    expect(savingStatusFor(FILE_A)).toBe("saved")
  })

  it("flushes the previous file when the fileId changes, then saves the new file", async () => {
    const { result, rerender } = renderHook(
      ({ fileId }: { fileId: string }) =>
        useAutoSave({ duration: DURATION, projectId: PROJECT_ID, fileId }),
      { wrapper, initialProps: { fileId: FILE_A } },
    )

    act(() => result.current({ content: "content for A" }))

    await act(async () => {
      rerender({ fileId: FILE_B })
    })

    expect(requests.saveFileContent).toHaveBeenCalledTimes(1)
    expect(requests.saveFileContent).toHaveBeenLastCalledWith(
      PROJECT_ID,
      FILE_A,
      "content for A",
      undefined,
    )

    act(() => result.current({ content: "content for B" }))
    await act(async () => {
      vi.advanceTimersByTime(DURATION)
    })

    expect(requests.saveFileContent).toHaveBeenCalledTimes(2)
    expect(requests.saveFileContent).toHaveBeenLastCalledWith(
      PROJECT_ID,
      FILE_B,
      "content for B",
      undefined,
    )
  })

  it("queues a newer payload while a save is in flight and sends it afterwards", async () => {
    const first = deferred<{ content: string; revision: number }>()
    requests.saveFileContent
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(
        (_projectId: string, _fileId: string, content: string) =>
          Promise.resolve({ content, revision: 3 }),
      )

    const { result } = renderHook(
      () =>
        useAutoSave({
          duration: DURATION,
          projectId: PROJECT_ID,
          fileId: FILE_A,
        }),
      { wrapper },
    )

    // First save starts and stays in flight (deferred unresolved).
    act(() => result.current({ content: "first" }))
    await act(async () => {
      vi.advanceTimersByTime(DURATION)
    })
    expect(requests.saveFileContent).toHaveBeenCalledTimes(1)

    // A newer edit lands while the first request is still pending.
    act(() => result.current({ content: "second" }))
    await act(async () => {
      vi.advanceTimersByTime(DURATION)
    })
    // Still in flight, so the second payload is queued, not sent yet.
    expect(requests.saveFileContent).toHaveBeenCalledTimes(1)

    // Resolve the first request; the queued payload should now be sent.
    await act(async () => {
      first.resolve({ content: "first", revision: 2 })
    })

    expect(requests.saveFileContent).toHaveBeenCalledTimes(2)
    expect(requests.saveFileContent).toHaveBeenLastCalledWith(
      PROJECT_ID,
      FILE_A,
      "second",
      undefined,
    )
  })

  it("marks the status as error and keeps the optimistic cache when a save fails", async () => {
    requests.saveFileContent.mockRejectedValue(new Error("network down"))
    const onSaveError = vi.fn()

    const { result } = renderHook(
      () =>
        useAutoSave({
          duration: DURATION,
          projectId: PROJECT_ID,
          fileId: FILE_A,
          onSaveError,
        }),
      { wrapper },
    )

    act(() => result.current({ content: "keep me" }))
    await act(async () => {
      vi.advanceTimersByTime(DURATION)
    })

    expect(savingStatusFor(FILE_A)).toBe("error")
    expect(onSaveError).toHaveBeenCalledTimes(1)
    // The user's text is preserved optimistically despite the failure.
    expect(contentCacheFor(FILE_A)).toMatchObject({
      type: "markdown",
      content: "keep me",
    })
  })
})

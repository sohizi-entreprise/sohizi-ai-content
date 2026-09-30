import { describe, expect, it } from "bun:test"
import { AgentStateManager } from "./state-manager"
import type { AgentJob } from "@/type"

function job(overrides: Partial<AgentJob> & Pick<AgentJob, "jobId">): AgentJob {
  return {
    kind: "image",
    status: "queued",
    toolCallId: `call-${overrides.jobId}`,
    label: overrides.jobId,
    ...overrides,
  }
}

describe("AgentStateManager job helpers", () => {
  it("hasPendingJobs is true only for queued or running jobs", () => {
    const state = new AgentStateManager()
    expect(state.hasPendingJobs()).toBe(false)

    state.addJob({
      jobId: "job-1",
      kind: "image",
      toolCallId: "call-1",
      label: "hero portrait",
    })
    expect(state.hasPendingJobs()).toBe(true)

    state.updateJob({ jobId: "job-1", status: "running" })
    expect(state.hasPendingJobs()).toBe(true)

    state.updateJob({ jobId: "job-1", status: "completed" })
    expect(state.hasPendingJobs()).toBe(false)
  })

  it("returns only unnotified terminal jobs and marks them after drain", () => {
    const state = new AgentStateManager()
    state.setState({
      ...state.getState(),
      jobs: [
        job({ jobId: "queued", status: "queued" }),
        job({ jobId: "done", status: "completed", result: "[]" }),
        job({ jobId: "failed", status: "failed", error: "timeout" }),
        job({
          jobId: "already",
          status: "completed",
          notified: true,
          result: "[]",
        }),
      ],
    })

    const first = state.getUnnotifiedTerminalJobs()
    expect(first.map((item) => item.jobId).sort()).toEqual(["done", "failed"])

    state.markJobsNotified(first.map((item) => item.jobId))
    expect(state.getUnnotifiedTerminalJobs()).toEqual([])
    expect(state.getJob("done")?.notified).toBe(true)
    expect(state.getJob("failed")?.notified).toBe(true)
    expect(state.getJob("already")?.notified).toBe(true)
  })

  it("drops only notified terminal jobs", () => {
    const state = new AgentStateManager()
    state.setState({
      ...state.getState(),
      jobs: [
        job({ jobId: "queued", status: "queued" }),
        job({ jobId: "running", status: "running" }),
        job({ jobId: "done-unnotified", status: "completed", result: "[]" }),
        job({
          jobId: "done-notified",
          status: "completed",
          notified: true,
          result: "[]",
        }),
        job({
          jobId: "failed-notified",
          status: "failed",
          notified: true,
          error: "timeout",
        }),
      ],
    })

    state.dropNotifiedTerminalJobs()

    expect(state.getState().jobs.map((item) => item.jobId)).toEqual([
      "queued",
      "running",
      "done-unnotified",
    ])
  })
})

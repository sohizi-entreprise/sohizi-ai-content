import { describe, expect, it } from "bun:test"
import {
  buildJobWaitOutput,
  formatJobUpdateNote,
  formatPendingJobReminder,
  isTerminalGenerationStatus,
  jobPatchFromRequest,
  pendingJobsFinishRefusal,
  applyFinishGuard,
  toAgentJobStatus,
} from "./job-status"
import { AgentStateManager } from "../core/state-manager"
import type { AgentJob } from "@/type"

const job: AgentJob = {
  jobId: "job-1",
  kind: "image",
  status: "queued",
  toolCallId: "call-1",
  label: "hero portrait",
}

describe("toAgentJobStatus", () => {
  it("maps generation request statuses onto agent jobs", () => {
    expect(toAgentJobStatus("pending")).toBe("queued")
    expect(toAgentJobStatus("processing")).toBe("running")
    expect(toAgentJobStatus("completed")).toBe("completed")
    expect(toAgentJobStatus("failed")).toBe("failed")
    expect(toAgentJobStatus("aborted")).toBe("failed")
  })
})

describe("isTerminalGenerationStatus", () => {
  it("treats completed, failed, and aborted as terminal", () => {
    expect(isTerminalGenerationStatus("completed")).toBe(true)
    expect(isTerminalGenerationStatus("failed")).toBe(true)
    expect(isTerminalGenerationStatus("aborted")).toBe(true)
    expect(isTerminalGenerationStatus("pending")).toBe(false)
    expect(isTerminalGenerationStatus("processing")).toBe(false)
  })
})

describe("buildJobWaitOutput", () => {
  it("prefers the generation request when both are present", () => {
    expect(
      buildJobWaitOutput(job, {
        id: "job-1",
        status: "completed",
        assets: [
          {
            assetId: "asset-1",
            type: "image",
            url: "https://cdn.example/hero.png",
            name: "hero.png",
          },
        ],
        error: null,
      }),
    ).toEqual({
      jobId: "job-1",
      status: "completed",
      kind: "image",
      label: "hero portrait",
      assets: [
        {
          assetId: "asset-1",
          type: "image",
          url: "https://cdn.example/hero.png",
          name: "hero.png",
        },
      ],
      result: JSON.stringify([
        {
          assetId: "asset-1",
          type: "image",
          url: "https://cdn.example/hero.png",
          name: "hero.png",
        },
      ]),
      error: null,
    })
  })

  it("falls back to the in-memory job when the request is missing", () => {
    expect(
      buildJobWaitOutput({
        ...job,
        status: "failed",
        error: "provider timeout",
      }),
    ).toEqual({
      jobId: "job-1",
      status: "failed",
      kind: "image",
      label: "hero portrait",
      assets: [],
      result: undefined,
      error: "provider timeout",
    })
  })
})

describe("jobPatchFromRequest", () => {
  it("maps a completed request row onto a job patch with assets", () => {
    expect(
      jobPatchFromRequest({
        id: "job-1",
        status: "completed",
        assets: [
          {
            assetId: "asset-1",
            type: "image",
            url: "https://cdn.example/hero.png",
            name: "hero.png",
          },
        ],
        error: null,
        request: { context: { mediaType: "image" } },
      }),
    ).toEqual({
      jobId: "job-1",
      status: "completed",
      result: JSON.stringify([
        {
          assetId: "asset-1",
          type: "image",
          url: "https://cdn.example/hero.png",
          name: "hero.png",
        },
      ]),
      error: undefined,
    })
  })

  it("maps aborted requests to a failed patch", () => {
    expect(
      jobPatchFromRequest({
        id: "job-2",
        status: "aborted",
        assets: null,
        error: "cancelled",
        request: null,
      }),
    ).toEqual({
      jobId: "job-2",
      status: "failed",
      result: undefined,
      error: "cancelled",
    })
  })
})

describe("formatJobUpdateNote", () => {
  it("formats completed and failed jobs for the next model turn", () => {
    const note = formatJobUpdateNote([
      {
        ...job,
        status: "completed",
        result: JSON.stringify([
          {
            assetId: "asset-1",
            type: "image",
            url: "https://cdn.example/hero.png",
            name: "hero.png",
          },
        ]),
      },
      {
        ...job,
        jobId: "job-2",
        label: "scene 3 vo",
        kind: "speech",
        status: "failed",
        error: "provider timeout",
      },
    ])

    expect(note).toContain("<job_update>")
    expect(note).toContain("hero portrait [job-1] completed")
    expect(note).toContain("https://cdn.example/hero.png")
    expect(note).toContain("scene 3 vo [job-2] failed: provider timeout")
    expect(note).toContain("Pending jobs are unchanged.")
  })
})

describe("formatPendingJobReminder", () => {
  it("lists still-running jobs after an early finish", () => {
    expect(formatPendingJobReminder([job])).toContain(
      "hero portrait [job-1] queued",
    )
  })
})

describe("pendingJobsFinishRefusal", () => {
  it("returns null when nothing is pending", () => {
    expect(pendingJobsFinishRefusal([])).toBeNull()
  })

  it("lists pending jobs so finish can be refused", () => {
    const message = pendingJobsFinishRefusal([{ ...job, status: "running" }])
    expect(message).toContain("hero portrait [job-1] (running)")
    expect(message).toContain("Call waitForJob")
  })

  it("blocks finishRun while jobs are pending and allows it afterward", () => {
    const state = new AgentStateManager()
    state.addJob({
      jobId: "job-1",
      kind: "image",
      toolCallId: "call-1",
      label: "hero portrait",
    })

    const refused = applyFinishGuard(state)
    expect(refused.allowed).toBe(false)
    expect(state.isExitStatus).toBe(false)

    state.updateJob({ jobId: "job-1", status: "completed" })
    const allowed = applyFinishGuard(state)
    expect(allowed.allowed).toBe(true)
    expect(state.status).toBe("finished")
  })
})

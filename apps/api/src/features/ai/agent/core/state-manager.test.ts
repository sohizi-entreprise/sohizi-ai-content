import { describe, expect, it } from "bun:test"
import { AgentStateManager } from "./state-manager"
import type { AgentJob, TokenUsage } from "@/type"

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

function usage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    input: 10,
    output: 4,
    reasoning: 1,
    cached: 2,
    total: 14,
    modelId: "openai/gpt-5.1",
    cost: 1,
    ...overrides,
  }
}

describe("AgentStateManager usage", () => {
  it("keeps conversation usage cumulative and run usage limited to this run", () => {
    const state = new AgentStateManager()
    state.setState({
      ...state.getState(),
      usage: usage({
        input: 100,
        output: 20,
        reasoning: 5,
        cached: 40,
        total: 120,
        cost: 4,
        modelId: "openai/gpt-5",
      }),
    })

    state.incrementUsage(usage())
    state.incrementUsage(
      usage({
        input: 3,
        output: 1,
        reasoning: 0,
        cached: 0,
        total: 4,
        cost: 2,
        modelId: "openai/gpt-5.1",
      }),
    )

    expect(state.getState().usage).toEqual(
      usage({
        input: 113,
        output: 25,
        reasoning: 6,
        cached: 42,
        total: 138,
        cost: 7,
        modelId: "openai/gpt-5",
      }),
    )
    expect(state.usageThisRun).toEqual(
      usage({
        input: 13,
        output: 5,
        reasoning: 1,
        cached: 2,
        total: 18,
        cost: 3,
        modelId: "openai/gpt-5.1",
      }),
    )
  })

  it("keeps the latest metered model step separate from cumulative usage", () => {
    const state = new AgentStateManager()
    state.setState({
      ...state.getState(),
      usage: usage({ input: 1_700_000, total: 1_750_000 }),
    })

    state.recordModelStepUsage(
      usage({ input: 102_000, output: 100, total: 102_100 }),
    )
    state.incrementUsage(usage({ input: 500, total: 504 }))

    expect(state.getState().usage?.input).toBe(1_802_500)
    expect(state.getState().latestRunUsage?.input).toBe(102_000)
    expect(state.usageThisRun?.input).toBe(102_500)

    state.recordModelStepUsage(usage({ input: 0, output: 0, total: 0 }))
    expect(state.getState().latestRunUsage?.input).toBe(102_000)
  })

  it("loads checkpoints created before latestRunUsage existed", () => {
    const state = new AgentStateManager()
    const legacy = { ...state.getState() }
    delete (legacy as Partial<typeof legacy>).latestRunUsage
    state.setState(legacy)
    expect(state.getState().latestRunUsage).toBeNull()
  })
})

describe("AgentStateManager appendMessages", () => {
  it("drops unsupported user file parts without mutating the input", () => {
    const state = new AgentStateManager()
    const user = {
      role: "user" as const,
      content: [
        { type: "text" as const, text: "look" },
        {
          type: "image" as const,
          image: new URL("https://cdn.example/shot.png"),
        },
        {
          type: "file" as const,
          data: new URL("https://cdn.example/clip.mp4"),
          mediaType: "video/mp4",
        },
        {
          type: "file" as const,
          data: new URL("https://cdn.example/notes.pdf"),
          mediaType: "application/pdf",
        },
        {
          type: "file" as const,
          data: new URL("https://cdn.example/notes.txt"),
          mediaType: "text/plain",
        },
        {
          type: "file" as const,
          data: new URL("https://cdn.example/voice.mp3"),
          mediaType: "audio/mpeg",
        },
      ],
    }

    state.appendMessages([user])

    const stored = state.getState().messages[0]
    expect(stored).not.toBe(user)
    if (
      !stored ||
      stored.role !== "user" ||
      typeof stored.content === "string"
    ) {
      throw new Error("expected user message parts")
    }
    expect(
      stored.content.map((part) =>
        part.type === "file" ? part.mediaType : part.type,
      ),
    ).toEqual(["text", "image", "application/pdf", "text/plain"])
    expect(user.content).toHaveLength(6)
  })

  it("keeps messages that need no filtering as the same objects", () => {
    const state = new AgentStateManager()
    const user = {
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
    }
    const assistant = { role: "assistant" as const, content: "ok" }

    state.appendMessages([user, assistant])

    expect(state.getState().messages[0]).toBe(user)
    expect(state.getState().messages[1]).toBe(assistant)
  })
})

describe("AgentStateManager fulfilled vendor", () => {
  it("keeps each vendor that served a model call, in order", () => {
    const state = new AgentStateManager()
    expect(state.fulfilledVendor).toBeNull()

    state.recordVendor("vercel-gateway")
    state.recordVendor("vercel-gateway")
    expect(state.fulfilledVendor).toBe("vercel-gateway")

    state.recordVendor("openrouter")
    expect(state.fulfilledVendor).toBe("vercel-gateway, openrouter")
  })
})

describe("AgentStateManager todos", () => {
  it("clearDoneTodos removes only tasks with status done", () => {
    const state = new AgentStateManager()
    state.setTodos([
      { id: "task_1", task: "First task", status: "done" },
      { id: "task_2", task: "Second task", status: "in_progress" },
      { id: "task_3", task: "Third task", status: "pending" },
      { id: "task_4", task: "Fourth task", status: "done" },
    ])

    state.clearDoneTodos()

    expect(state.todos).toEqual([
      { id: "task_2", task: "Second task", status: "in_progress" },
      { id: "task_3", task: "Third task", status: "pending" },
    ])
  })
})

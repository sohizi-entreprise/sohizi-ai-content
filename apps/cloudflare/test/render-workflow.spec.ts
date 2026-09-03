import { beforeEach, describe, expect, it, vi } from "vitest"
import { createTestEnv } from "./fakes"
import type { RenderWorkflowParams } from "../src/render/contracts"

const containerFetch =
  vi.fn<(url: string, init: RequestInit) => Promise<Response>>()

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  ContainerProxy: class {},
  getContainer: () => ({
    fetch: (url: string, init: RequestInit) => containerFetch(url, init),
  }),
}))

const { RenderWorkflow } = await import("../src/render/workflow")

const PARAMS: RenderWorkflowParams = {
  jobId: "job-1",
  projectId: "project-1",
  compositionId: "composition-1",
  fileName: "export.mp4",
  inputKey: "renders/project-1/job-1.input.json",
  outputKey: "renders/project-1/job-1.mp4",
  progressKey: "renders/project-1/job-1.progress.json",
  frameCount: 90,
}

/** Executes step callbacks inline and records the step names that ran. */
function createStep() {
  const names: Array<string> = []
  const sleeps: Array<string> = []
  return {
    names,
    sleeps,
    step: {
      do: async (
        name: string,
        configOrCallback: unknown,
        maybeCallback?: unknown,
      ) => {
        names.push(name)
        const callback = (
          typeof configOrCallback === "function"
            ? configOrCallback
            : maybeCallback
        ) as (ctx: unknown) => Promise<unknown>
        return callback({})
      },
      sleep: async (name: string) => {
        sleeps.push(name)
      },
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function statusBody(overrides: Record<string, unknown> = {}) {
  return {
    jobId: PARAMS.jobId,
    state: "running",
    progress: 0.5,
    renderedFrames: 45,
    encodedFrames: 40,
    ...overrides,
  }
}

function runWorkflow(env: unknown) {
  const instance = new RenderWorkflow({} as never, env as never)
  const { step, names, sleeps } = createStep()
  const promise = instance.run(
    {
      payload: PARAMS,
      timestamp: new Date(),
      instanceId: PARAMS.jobId,
      workflowName: "test",
    },
    step as never,
  )
  return { promise, names, sleeps }
}

describe("RenderWorkflow", () => {
  beforeEach(() => {
    containerFetch.mockReset()
  })

  it("starts the render, publishes progress and stores the output in R2", async () => {
    const { bucket, env } = createTestEnv()
    await bucket.put(PARAMS.inputKey, JSON.stringify({ jobId: PARAMS.jobId }))

    const video = new Uint8Array(64).fill(9)
    let statusCalls = 0
    containerFetch.mockImplementation(async (url, init) => {
      const { pathname } = new URL(url)
      if (init.method === "POST" && pathname === "/renders") {
        return jsonResponse(statusBody(), 202)
      }
      if (init.method === "GET" && pathname.endsWith("/output")) {
        return new Response(video, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(video.byteLength),
          },
        })
      }
      if (init.method === "GET") {
        statusCalls += 1
        return jsonResponse(
          statusCalls === 1
            ? statusBody()
            : statusBody({
                state: "completed",
                progress: 1,
                renderedFrames: 90,
              }),
        )
      }
      return new Response(null, { status: 200 })
    })

    const { promise, names, sleeps } = runWorkflow(env)
    const output = await promise

    expect(output).toMatchObject({
      outputKey: PARAMS.outputKey,
      sizeInBytes: video.byteLength,
      frameCount: 90,
    })
    expect(bucket.objects.get(PARAMS.outputKey)?.byteLength).toBe(
      video.byteLength,
    )

    // Temporary objects are removed once the render is stored.
    expect(bucket.objects.has(PARAMS.inputKey)).toBe(false)
    expect(bucket.objects.has(PARAMS.progressKey)).toBe(false)

    expect(names).toContain("start render")
    expect(names).toContain("publish progress 0")
    expect(names).toContain("store output")
    expect(names).toContain("cleanup")
    expect(sleeps).toEqual(["wait 0"])
  })

  it("sends the snapshot as a buffered string so the subrequest has a known length", async () => {
    const { bucket, env } = createTestEnv()
    const snapshot = JSON.stringify({
      jobId: PARAMS.jobId,
      composition: { fps: 30 },
    })
    await bucket.put(PARAMS.inputKey, snapshot)

    let startBody: unknown
    containerFetch.mockImplementation(async (_url, init) => {
      if (init.method === "POST") {
        startBody = init.body
        return jsonResponse(statusBody(), 202)
      }
      return jsonResponse(
        statusBody({
          state: "failed",
          error: {
            code: "render_failed",
            message: "stop here",
            retryable: false,
          },
        }),
      )
    })

    const { promise } = runWorkflow(env)
    await expect(promise).rejects.toThrow(/stop here/)

    // An R2 body stream has no declared length and can only be read once, so
    // the runtime rejects it as a request body and step retries would fail.
    expect(typeof startBody).toBe("string")
    expect(startBody).toBe(snapshot)
  })

  it("fails without retrying when the container reports a permanent error", async () => {
    const { bucket, env } = createTestEnv()
    await bucket.put(PARAMS.inputKey, JSON.stringify({ jobId: PARAMS.jobId }))
    await bucket.put(PARAMS.progressKey, JSON.stringify({ progress: 0.5 }))

    containerFetch.mockImplementation(async (_url, init) => {
      if (init.method === "POST") return jsonResponse(statusBody(), 202)
      return jsonResponse(
        statusBody({
          state: "failed",
          error: {
            code: "render_failed",
            message: "Asset 404",
            retryable: false,
          },
        }),
      )
    })

    const { promise, names } = runWorkflow(env)
    await expect(promise).rejects.toMatchObject({
      name: "NonRetryableError",
      message: "Asset 404",
    })

    expect(names).toContain("cleanup after failure")
    expect(bucket.objects.has(PARAMS.inputKey)).toBe(false)
    expect(bucket.objects.has(PARAMS.progressKey)).toBe(false)
  })

  it("fails when the render input is gone", async () => {
    const { env } = createTestEnv()
    const { promise } = runWorkflow(env)
    await expect(promise).rejects.toThrow(/missing from R2/)
  })

  it("gives up after the configured timeout", async () => {
    const { bucket, env } = createTestEnv({
      RENDER_TIMEOUT_MINUTES: "1",
      RENDER_POLL_INTERVAL_SECONDS: "30",
    })
    await bucket.put(PARAMS.inputKey, JSON.stringify({ jobId: PARAMS.jobId }))

    containerFetch.mockImplementation(async (_url, init) => {
      if (init.method === "POST") return jsonResponse(statusBody(), 202)
      return jsonResponse(statusBody({ renderedFrames: 1 }))
    })

    const { promise, sleeps } = runWorkflow(env)
    await expect(promise).rejects.toThrow(/exceeded the 1 minute limit/)
    expect(sleeps).toHaveLength(2)
    expect(bucket.objects.has(PARAMS.inputKey)).toBe(false)
  })
})

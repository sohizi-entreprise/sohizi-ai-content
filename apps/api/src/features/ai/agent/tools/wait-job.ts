import { buildBaseTool } from "./tool-definition"
import { z } from "zod"
import { failure, success } from "./utils"
import { generateAsset } from "@/features/media-engine/service"
import { getModelSchema } from "@/features/media-engine/repo"
import { readStreamChunks } from "@/features/generation-request/stream-handler"
import { getErrorMessage } from "@/utils/get-error-message"
import { validateInput } from "./validate-model-params"
import { buildJobWaitOutput, isTerminalGenerationStatus } from "./job-status"
import { syncJobFromRequest } from "./job-sync"
import type { AgentStateManager } from "../core/state-manager"

const JOB_POLL_INTERVAL_MS = 2000

export const waitForJob = buildBaseTool({
  name: "waitForJob",
  description:
    "Blocks the execution and waits until a job is completed or failed. Use after submitAssetGenerationJob when you need the result before continuing.",
  inputSchema: z.object({
    jobId: z
      .string()
      .describe("The job ID returned by submitAssetGenerationJob"),
  }),
  execute: async ({ jobId }, { session, state, abortSignal }) => {
    try {
      const tracked = state.getJob(jobId)
      if (tracked?.status === "completed" || tracked?.status === "failed") {
        state.markJobsNotified([jobId])
        return tracked.status === "failed"
          ? failure(JSON.stringify(buildJobWaitOutput(tracked)))
          : success(JSON.stringify(buildJobWaitOutput(tracked)))
      }

      const settled = await waitUntilTerminal(
        session.projectId,
        jobId,
        state,
        abortSignal,
      )
      if (!settled) {
        return failure(`Job ${jobId} not found`)
      }

      const output = buildJobWaitOutput(settled.job, settled.request)
      if (output.status === "failed") {
        return failure(JSON.stringify(output))
      }
      return success(JSON.stringify(output))
    } catch (error) {
      return failure(getErrorMessage(error, `Failed to wait for job ${jobId}`))
    }
  },
})

export const getJobStatus = buildBaseTool({
  name: "getJobStatus",
  description: "Gets the current status of a submitted job without blocking.",
  inputSchema: z.object({
    jobId: z
      .string()
      .describe("The job ID returned by submitAssetGenerationJob"),
  }),
  execute: async ({ jobId }, { session, state }) => {
    try {
      const resolved = await syncJobFromRequest(session.projectId, jobId, state)
      if (resolved) {
        return success(
          JSON.stringify(buildJobWaitOutput(resolved.job, resolved.request)),
        )
      }
      const tracked = state.getJob(jobId)
      if (!tracked) {
        return failure(`Job ${jobId} not found`)
      }
      return success(JSON.stringify(buildJobWaitOutput(tracked)))
    } catch (error) {
      return failure(
        getErrorMessage(error, `Failed to get status for job ${jobId}`),
      )
    }
  },
})

export const submitAssetGenerationJob = buildBaseTool({
  name: "submitAssetGenerationJob",
  description:
    "Use this tool to submit jobs that run asynchronously, like assets generation (image, video, audio, speech, etc.). It returns a jobId on success. Continue other work, or call waitForJob if you need the result now.",
  inputSchema: z.object({
    kind: z.enum(["image", "video", "audio", "speech"]),
    label: z
      .string()
      .describe(
        "A short label that identifies the asset, like 'hero portrait', 'scene 3 vo'",
      ),
    modelId: z.string().describe("The model ID to use for the generation"),
    parameters: z
      .record(z.string(), z.unknown())
      .describe(
        "The parameters to use for the generation based on the model schema",
      ),
  }),
  execute: async (input, { session, state, artifacts, toolCallId }) => {
    try {
      let schema = artifacts.get(`schema-${input.modelId}`) as
        Awaited<ReturnType<typeof getModelSchema>> | undefined
      if (!schema) {
        schema = await getModelSchema(input.modelId)
        artifacts.set(`schema-${input.modelId}`, schema)
      }

      const validation = validateInput(schema, input.parameters)
      if (!validation.isValid) {
        return failure(
          `Validation failed. ${validation.errorMsg} Fix the parameters and call submitAssetGenerationJob again.`,
        )
      }

      const mediaType = input.kind === "speech" ? "audio" : input.kind
      const run = await generateAsset({
        userId: session.userId,
        projectId: session.projectId,
        organizationId: session.organizationId,
        model: input.modelId,
        settings: input.parameters,
        context: {
          mediaType,
          referenceFiles: extractReferenceFiles(input.parameters, mediaType),
        },
      })

      state.addJob({
        jobId: run.id,
        kind: input.kind,
        toolCallId,
        label: input.label,
      })

      return success(
        JSON.stringify({
          jobId: run.id,
          status: "queued",
          kind: input.kind,
          label: input.label,
        }),
      )
    } catch (error) {
      return failure(
        getErrorMessage(
          error,
          "An error occurred while submitting the asset generation job",
        ),
      )
    }
  },
})

async function waitUntilTerminal(
  projectId: string,
  jobId: string,
  state: AgentStateManager,
  abortSignal: AbortSignal,
) {
  const initial = await syncJobFromRequest(projectId, jobId, state)
  if (!initial) return null
  if (isTerminalGenerationStatus(initial.request.status)) {
    return initial
  }

  for await (const chunk of readStreamChunks(jobId)) {
    if (abortSignal.aborted) {
      throw new Error(`Wait for job ${jobId} was aborted`)
    }
    const event = (chunk.data as { event?: string } | undefined)?.event
    if (event === "done") break
  }

  let latest = await syncJobFromRequest(projectId, jobId, state)
  if (!latest) return null
  if (isTerminalGenerationStatus(latest.request.status)) {
    return latest
  }

  while (!abortSignal.aborted) {
    await delay(JOB_POLL_INTERVAL_MS)
    if (abortSignal.aborted) break
    latest = await syncJobFromRequest(projectId, jobId, state)
    if (!latest) return null
    if (isTerminalGenerationStatus(latest.request.status)) {
      return latest
    }
  }

  throw new Error(`Wait for job ${jobId} was aborted`)
}

function extractReferenceFiles(
  parameters: Record<string, unknown>,
  mediaType: "image" | "video" | "audio",
): Array<{ url: string; type: "image" | "video" | "audio" }> {
  const raw =
    parameters.referenceFiles ??
    parameters.referencedFiles ??
    parameters.references

  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (typeof item === "string" && item.length > 0) {
      return [{ url: item, type: mediaType }]
    }
    if (item && typeof item === "object" && "url" in item) {
      const url = (item as { url?: unknown }).url
      const type = (item as { type?: unknown }).type
      if (typeof url !== "string" || url.length === 0) return []
      if (type === "image" || type === "video" || type === "audio") {
        return [{ url, type }]
      }
      return [{ url, type: mediaType }]
    }
    return []
  })
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

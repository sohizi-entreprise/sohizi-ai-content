import type {
  AgentJob,
  GenerationRequestAsset,
  GenerationRequestStatus,
} from "@/type"
import type { GenerationRequest } from "@/db/schema"

export type GenerationRequestJobRow = Pick<
  GenerationRequest,
  "id" | "status" | "assets" | "error" | "request"
>

export function toAgentJobStatus(
  status: GenerationRequestStatus,
): AgentJob["status"] {
  switch (status) {
    case "pending":
      return "queued"
    case "processing":
      return "running"
    case "completed":
      return "completed"
    case "failed":
    case "aborted":
      return "failed"
  }
}

export function isTerminalGenerationStatus(
  status: GenerationRequestStatus,
): boolean {
  return status === "completed" || status === "failed" || status === "aborted"
}

export function isTerminalAgentJobStatus(status: AgentJob["status"]): boolean {
  return status === "completed" || status === "failed"
}

export function jobPatchFromRequest(
  request: GenerationRequestJobRow,
): Pick<AgentJob, "jobId" | "status" | "result" | "error"> {
  const status = toAgentJobStatus(request.status)
  return {
    jobId: request.id,
    status,
    result:
      request.status === "completed"
        ? JSON.stringify(request.assets ?? [])
        : undefined,
    error: request.error ?? undefined,
  }
}

export function inferJobKind(
  request: GenerationRequestJobRow,
): AgentJob["kind"] {
  const context = request.request?.context as {
    mediaType?: unknown
    generationType?: unknown
  }
  const mediaType = context?.mediaType ?? context?.generationType
  if (
    mediaType === "video" ||
    mediaType === "audio" ||
    mediaType === "speech"
  ) {
    return mediaType
  }
  return "image"
}

export function buildJobWaitOutput(
  job?: Pick<
    AgentJob,
    "jobId" | "status" | "kind" | "label" | "result" | "error"
  >,
  request?: Pick<GenerationRequest, "id" | "status" | "assets" | "error">,
) {
  const status = request
    ? toAgentJobStatus(request.status)
    : (job?.status ?? "queued")
  const assets = (request?.assets ?? []) as GenerationRequestAsset[]
  const error = request?.error ?? job?.error ?? null
  const result =
    status === "completed" ? JSON.stringify(assets) : (job?.result ?? undefined)

  return {
    jobId: request?.id ?? job?.jobId,
    status,
    kind: job?.kind,
    label: job?.label,
    assets,
    result,
    error,
  }
}

export function formatJobUpdateNote(jobs: AgentJob[]): string {
  const lines = jobs.map((job) => {
    const headline = `- ${job.label} [${job.jobId}] ${job.status}`
    if (job.status === "failed") {
      return job.error ? `${headline}: ${job.error}` : headline
    }
    if (job.result) {
      return `${headline}\n  assets: ${job.result}`
    }
    return headline
  })

  return `<job_update>
These background jobs finished:
${lines.join("\n")}
Use these results if needed. Pending jobs are unchanged.
</job_update>`
}

export function formatPendingJobReminder(jobs: AgentJob[]): string {
  const lines = jobs.map((job) => `- ${job.label} [${job.jobId}] ${job.status}`)
  return `<job_update>
You attempted to finish while these jobs are still running:
${lines.join("\n")}
Call waitForJob if you need the result. If you no longer need them, you may finish.
</job_update>`
}

export function pendingJobsFinishRefusal(jobs: AgentJob[]): string | null {
  if (jobs.length === 0) return null
  const listed = jobs
    .map((job) => `${job.label} [${job.jobId}] (${job.status})`)
    .join(", ")
  return `Cannot finish: ${jobs.length} job(s) still running: ${listed}. Call waitForJob if you need the result, or end your turn without tools if you no longer need them.`
}

export function applyFinishGuard(state: {
  getPendingJobs: () => AgentJob[]
  finishRun: () => void
}): { allowed: boolean; output: string } {
  const refusal = pendingJobsFinishRefusal(state.getPendingJobs())
  if (refusal) {
    return { allowed: false, output: refusal }
  }
  state.finishRun()
  return { allowed: true, output: "finished" }
}

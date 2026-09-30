import {
  getGenerationRequestById,
  getGenerationRequestsByIds,
} from "@/features/generation-request/repo"
import type { AgentStateManager } from "../core/state-manager"
import type { AgentJob } from "@/type"
import type { GenerationRequest } from "@/db/schema"
import {
  inferJobKind,
  isTerminalAgentJobStatus,
  jobPatchFromRequest,
  type GenerationRequestJobRow,
} from "./job-status"

export type ResolvedJob = {
  request: GenerationRequest
  job: AgentJob
}

export async function syncJobFromRequest(
  projectId: string,
  jobId: string,
  state: AgentStateManager,
): Promise<ResolvedJob | null> {
  const request = await getGenerationRequestById(projectId, jobId)
  if (!request) return null

  const job = applyRequestToState(state, request, {
    markNotifiedIfTerminal: true,
    createIfMissing: true,
  })
  return { request, job }
}

export async function refreshAgentJobs(
  projectId: string,
  state: AgentStateManager,
): Promise<void> {
  const jobs = state.getState().jobs
  if (jobs.length === 0) return

  const rows = await getGenerationRequestsByIds(
    projectId,
    jobs.map((job) => job.jobId),
  )
  for (const row of rows) {
    applyRequestToState(state, row, {
      markNotifiedIfTerminal: false,
      createIfMissing: false,
    })
  }
}

function applyRequestToState(
  state: AgentStateManager,
  request: GenerationRequestJobRow,
  options: { markNotifiedIfTerminal: boolean; createIfMissing: boolean },
): AgentJob {
  const patch = jobPatchFromRequest(request)
  const notified =
    options.markNotifiedIfTerminal && isTerminalAgentJobStatus(patch.status)
      ? true
      : undefined

  state.updateJob({
    ...patch,
    ...(notified ? { notified } : {}),
  })

  const existing = state.getJob(request.id)
  if (existing) {
    return existing
  }

  const created: AgentJob = {
    jobId: request.id,
    kind: inferJobKind(request),
    status: patch.status,
    toolCallId: "",
    label: request.id,
    result: patch.result,
    error: patch.error,
    ...(notified ? { notified } : {}),
  }

  if (options.createIfMissing) {
    state.addJob({
      jobId: created.jobId,
      kind: created.kind,
      toolCallId: created.toolCallId,
      label: created.label,
    })
    state.updateJob({
      jobId: created.jobId,
      status: created.status,
      result: created.result,
      error: created.error,
      ...(notified ? { notified } : {}),
    })
  }

  return state.getJob(request.id) ?? created
}

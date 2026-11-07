import {
  CancelResponse,
  EstimateRequestPriceResponse,
  GetRequestDataResponse,
  MediaEngineProvider,
  SubmitPayload,
  SubmitResponse,
} from "./type"
import { replicateFuncs } from "@/lib/replicate"

const TERMINAL_JOB_STATUSES = new Set(["failed", "cancelled", "timeout"])

function toRequestData(
  outputs: unknown,
): Array<string | Record<string, string>> {
  if (Array.isArray(outputs)) {
    return outputs.filter(
      (item): item is string | Record<string, string> =>
        typeof item === "string" ||
        (item !== null && typeof item === "object" && !Array.isArray(item)),
    )
  }
  if (typeof outputs === "string") return [outputs]
  if (outputs && typeof outputs === "object") {
    return [outputs as Record<string, string>]
  }
  return []
}

function terminalErrorMessage(outputs: unknown, status: string): string {
  if (typeof outputs === "string" && outputs.trim() !== "") return outputs
  if (outputs != null) {
    try {
      const serialized = JSON.stringify(outputs)
      if (serialized !== "[]" && serialized !== "{}") return serialized
    } catch {
      return status
    }
  }
  return status
}

export class ReplicateProvider implements MediaEngineProvider {
  constructor(private readonly apiKey: string) {}

  async submitRequest(
    apiName: string,
    payload: SubmitPayload,
  ): Promise<SubmitResponse> {
    const response = await replicateFuncs.submitJob(
      this.apiKey,
      apiName,
      payload,
    )
    return {
      requestId: response.jobId,
      status: response.status,
    }
  }

  async getRequestData(requestId: string): Promise<GetRequestDataResponse> {
    const response = await replicateFuncs.getJobResult(this.apiKey, requestId)
    if (response.status === "completed") {
      return {
        status: "completed",
        data: toRequestData(response.outputs),
      }
    }
    if (TERMINAL_JOB_STATUSES.has(response.status)) {
      return {
        status: "error",
        error: terminalErrorMessage(response.outputs, response.status),
      }
    }
    return { status: response.status }
  }

  async cancelRequest(requestId: string): Promise<CancelResponse> {
    const ok = await replicateFuncs.cancelJob(this.apiKey, requestId)
    return {
      requestId,
      ok,
    }
  }

  async estimateRequestPrice(
    _modelId: string,
    _payload: SubmitPayload,
  ): Promise<EstimateRequestPriceResponse> {
    return {
      ok: false,
      error: "Replicate does not support cost estimation",
    }
  }
}

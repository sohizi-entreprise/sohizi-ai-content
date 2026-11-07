import {
  CancelResponse,
  EstimateRequestPriceResponse,
  GetRequestDataResponse,
  MediaEngineProvider,
  SubmitResponse,
  SubmitPayload,
} from "./type"
import { waveSpeedFuncs } from "@/lib/wave-speed"

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
  if (outputs && typeof outputs === "object")
    return [outputs as Record<string, string>]
  return []
}

function terminalErrorMessage(
  error: unknown,
  outputs: unknown,
  status: string,
): string {
  if (typeof error === "string" && error.trim() !== "") return error
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

export class WaveSpeedProvider implements MediaEngineProvider {
  constructor(private readonly apiKey: string) {}

  async submitRequest(
    apiName: string,
    payload: SubmitPayload,
  ): Promise<SubmitResponse> {
    const response = await waveSpeedFuncs.submitJob(
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
    const response = await waveSpeedFuncs.getJobResult(this.apiKey, requestId)
    if (response.status === "completed") {
      return {
        status: "completed",
        data: toRequestData(response.outputs),
      }
    }
    if (TERMINAL_JOB_STATUSES.has(response.status)) {
      return {
        status: "error",
        error: terminalErrorMessage(
          response.error,
          response.outputs,
          response.status,
        ),
      }
    }
    return { status: response.status }
  }

  async cancelRequest(requestId: string): Promise<CancelResponse> {
    const response = await waveSpeedFuncs.deleteJob(this.apiKey, [requestId])
    return {
      requestId: requestId,
      ok: response > 0,
    }
  }

  async estimateRequestPrice(
    apiName: string,
    payload: SubmitPayload,
  ): Promise<EstimateRequestPriceResponse> {
    const response = await waveSpeedFuncs.getInferencePrice(
      this.apiKey,
      apiName,
      payload,
    )
    return {
      ok: true,
      priceUSD: response.price,
    }
  }
}

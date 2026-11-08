import { captureConsentedEvent } from "@/features/analytics-consent"
import { NonRetriableError } from "inngest"
import { captureUnexpectedError } from "@/sentry"
import { inngest } from "@/lib/inngest/client"
import * as repo from "./repo"
import * as storage from "./storage"
import { v4 as uuidv4 } from "uuid"
import { Asset } from "@/db/schema"
import { billingService, safeRefund } from "@/features/billing"
import { isMediaError } from "./errors"
import {
  finalizeGenerationRequest,
  writeStreamData,
} from "../generation-request/stream-handler"
import { appendRequestAssets } from "../generation-request/repo"
import type { GenerationRequestAsset } from "@/type"
import { estimateCatalogMediaCostUsd, mediaOverheadRate } from "./catalog-cost"
import { extractOutputUrls } from "./providers/utils"
import type { SubmitPayload } from "./providers/type"
import { providerCostToActualCredits } from "./generators/cost-utils"
import { getErrorMessage } from "@/utils/get-error-message"
import {
  pollMediaRequest,
  releaseMediaLeases,
  renewMediaLeases,
  submitMediaWithCapacity,
  type MediaSticky,
} from "./submit-media"
import { tryAcquireCapacity } from "@/features/capacity/router"
import { renewUserSlot } from "@/features/capacity/user-gate"
import { getGenerationRequest } from "@/features/generation-request/repo"
import { MAX_MEDIA_POLL_ATTEMPTS, VIDEO_POLL_INTERVAL } from "./constants"

const MEDIA_POLL_INTERVAL = "5s"
const SYNC_RESERVATION_TTL_MS = 30 * 60 * 1000
const VIDEO_RESERVATION_TTL_MS = 60 * 60 * 1000

type ProviderMediaType = "image" | "video" | "audio"

type ReferenceFile = { url: string; type: "image" | "video" | "audio" }

type ProviderMediaEventData = {
  requestId: string
  projectId: string
  organizationId: string
  userId: string
  model: string
  payload: SubmitPayload
  referenceFiles: ReferenceFile[]
  mediaType: ProviderMediaType
  _reservationId: string
  priceUSD?: number
  analyticsConsentId?: string | null
}

function mediaReservationTtlMs(mediaType: ProviderMediaType): number {
  return mediaType === "video"
    ? VIDEO_RESERVATION_TTL_MS
    : SYNC_RESERVATION_TTL_MS
}

function mediaPollInterval(mediaType: ProviderMediaType) {
  return mediaType === "video" ? VIDEO_POLL_INTERVAL : MEDIA_POLL_INTERVAL
}

function isTerminalFailureStatus(status: string): boolean {
  return (
    status === "error" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "timeout"
  )
}

function shouldRetry(error: unknown): boolean {
  if (isMediaError(error)) {
    return error.isRetriable
  }
  return false
}

function wrapNonRetryable(error: unknown): never {
  if (shouldRetry(error)) {
    throw error
  }

  const message = getErrorMessage(error)
  const cause = error instanceof Error ? error : undefined

  throw new NonRetriableError(message, { cause })
}

function toRequestAsset(asset: Asset): GenerationRequestAsset | null {
  if (
    asset.type === "image" ||
    asset.type === "video" ||
    asset.type === "audio" ||
    asset.type === "html"
  ) {
    return {
      assetId: asset.id,
      type: asset.type,
      url: asset.url,
      name: asset.name,
    }
  }
  return null
}

// ─── Provider Media Generation ───────────────────────────────────────

export const handleMediaGeneration = inngest.createFunction(
  {
    id: "media-generate",
    retries: 1,
    triggers: [{ event: "media/generate" }],
    onFailure: async ({ event }) => {
      const data = event.data.event.data as ProviderMediaEventData
      captureUnexpectedError(event.data.error, {
        job: "media-generate",
        project_id: data.projectId,
        request_id: data.requestId,
        model: data.model,
      })
      await safeRefund(
        billingService,
        data._reservationId,
        "media-generation-failed",
      )
      if (data.requestId) {
        await releaseMediaLeases(data.requestId).catch((error) => {
          console.error("[media] failure release failed", data.requestId, error)
        })
        await finalizeGenerationRequest(
          data.requestId,
          "failed",
          getErrorMessage(event.data.error, "Media generation failed"),
        )
        await captureConsentedEvent(
          data.analyticsConsentId,
          data.userId,
          "generation_failed",
          {
            project_id: data.projectId,
            request_id: data.requestId,
            media_type: data.mediaType,
            failure_category: "job_failed",
          },
        )
      }
    },
  },
  async ({ event, step }) => {
    const data = event.data as ProviderMediaEventData
    const {
      requestId,
      projectId,
      userId,
      model,
      payload,
      mediaType,
      _reservationId: reservationId,
    } = data
    const overheadRate = mediaOverheadRate(mediaType)
    const reservationTtlMs = mediaReservationTtlMs(mediaType)
    const pollInterval = mediaPollInterval(mediaType)

    const requestPayload = payload

    let sticky: MediaSticky | undefined
    for (let attempt = 0; attempt < 12; attempt++) {
      const acquired = await step.run(`acquire-${attempt}`, async () => {
        const row = await getGenerationRequest(requestId)
        if (
          row?.providerRequestId &&
          row.capacityLease &&
          row.capacityAccountId
        ) {
          return { ready: true as const }
        }
        if (row?.userLease) await renewUserSlot(row.userLease, reservationTtlMs)
        return tryAcquireCapacity({
          task: `media:${model}`,
          holderId: requestId,
          leaseTtlMs: reservationTtlMs,
        })
      })
      if ("ready" in acquired || acquired.ok) break
      if (acquired.reason === "no_route") {
        throw new NonRetriableError(`No media route for ${model}`)
      }
      if (attempt === 11) {
        throw new NonRetriableError("Media capacity wait timed out")
      }
      const seconds = Math.max(1, Math.ceil(acquired.retryAfterMs / 1000))
      await step.sleep(`wait-capacity-${attempt}`, `${seconds}s`)
    }

    try {
      try {
        sticky = await step.run("submit-job", async () => {
          const { modelId, ...payload } = requestPayload
          return submitMediaWithCapacity({
            requestId,
            modelId: (modelId as string) || model,
            payload,
            leaseTtlMs: reservationTtlMs,
          })
        })
      } catch (error) {
        wrapNonRetryable(error)
      }

      let resultData: unknown = null

      for (let attempt = 0; attempt < MAX_MEDIA_POLL_ATTEMPTS; attempt++) {
        await step.sleep(`wait-for-media-${attempt}`, pollInterval)

        await step.run(`renew-reservation-${attempt}`, async () => {
          await billingService.renewIfNearExpiry(
            reservationId,
            reservationTtlMs,
          )
          await renewMediaLeases(requestId, reservationTtlMs)
        })

        const pollResult = await step.run(`poll-media-${attempt}`, async () => {
          try {
            const row = await getGenerationRequest(requestId)
            if (row?.cancelRequestedAt) {
              return { status: "cancelled" as const }
            }
            return await pollMediaRequest(requestId)
          } catch (error) {
            wrapNonRetryable(error)
          }
        })

        if (pollResult.status === "completed") {
          resultData = "data" in pollResult ? pollResult.data : null
          break
        }

        if (pollResult.status === "cancelled") {
          return { requestId, status: "cancelled" as const }
        }

        if (isTerminalFailureStatus(String(pollResult.status))) {
          const providerError =
            "error" in pollResult &&
            typeof pollResult.error === "string" &&
            pollResult.error.trim().length > 0
              ? pollResult.error
              : `Provider generation ${String(pollResult.status)}`
          await step.run("refund-on-provider-failure", () =>
            safeRefund(billingService, reservationId, "media-provider-failed"),
          )
          await step.run("mark-error-on-provider-failure", () =>
            finalizeGenerationRequest(requestId, "failed", providerError),
          )
          await captureConsentedEvent(
            data.analyticsConsentId,
            userId,
            "generation_failed",
            {
              project_id: projectId,
              request_id: requestId,
              media_type: mediaType,
              failure_category: "provider_failed",
            },
          )
          return { requestId, status: "failed" as const }
        }
      }

      const outputUrls = extractOutputUrls(resultData)
      if (outputUrls.length === 0) {
        const emptyOrTimeoutError = resultData
          ? "Provider returned no valid media output"
          : "Media generation timed out"
        await step.run("refund-on-timeout-or-empty", () =>
          safeRefund(
            billingService,
            reservationId,
            resultData ? "media-no-valid-urls" : "media-poll-timeout",
          ),
        )
        await step.run("mark-error-on-timeout-or-empty", () =>
          finalizeGenerationRequest(requestId, "failed", emptyOrTimeoutError),
        )
        await captureConsentedEvent(
          data.analyticsConsentId,
          userId,
          "generation_failed",
          {
            project_id: projectId,
            request_id: requestId,
            media_type: mediaType,
            failure_category: "timeout_or_empty",
          },
        )
        return { requestId, status: "failed" as const }
      }

      const uploads = await step.run("upload-to-r2", async () => {
        const uploaded = []
        for (const sourceUrl of outputUrls) {
          uploaded.push(await storage.uploadGeneratedMedia(sourceUrl))
        }
        return uploaded
      })

      await step.run("settle-credits", async () => {
        const providerCostUsd = sticky?.providerCostUsd
        const actualCostUsd =
          data.priceUSD ??
          (await estimateCatalogMediaCostUsd(model, requestPayload))
        return billingService.settle({
          reservationId,
          actualCredits: providerCostToActualCredits(actualCostUsd, {
            overheadRate,
          }),
          providerCostUsd,
          metadata: {
            requestId,
            ...(providerCostUsd !== undefined ? { providerCostUsd } : {}),
            vendor: sticky?.vendorName,
          },
        })
      })

      const assets = await step.run("save-assets", async () => {
        const newAssets: Asset[] = []
        for (const upload of uploads) {
          const fileMetadata = await storage.getFileMetadata(upload.storageKey)
          const assetName =
            upload.storageKey.split("/").pop() ??
            `${upload.type}-${uuidv4().slice(0, 8)}`
          const asset = await repo.createAsset({
            projectId,
            name: assetName,
            type: upload.type,
            url: upload.url,
            source: "ai-generated",
            generationRequestId: requestId,
            metadata: fileMetadata,
            storageKey: upload.storageKey,
          })
          await writeStreamData(requestId, {
            runId: requestId,
            event: "asset",
            data: asset,
          })
          newAssets.push(asset)
        }

        const requestAssets = newAssets
          .map(toRequestAsset)
          .filter((asset): asset is GenerationRequestAsset => asset !== null)
        if (requestAssets.length > 0) {
          await appendRequestAssets(requestId, requestAssets)
        }

        await finalizeGenerationRequest(requestId, "completed")
        await captureConsentedEvent(
          data.analyticsConsentId,
          userId,
          "generation_succeeded",
          {
            project_id: projectId,
            request_id: requestId,
            media_type: mediaType,
          },
        )
        return newAssets
      })

      return { requestId, assets, reservationId }
    } finally {
      await step.run("release-slot", async () => {
        await releaseMediaLeases(requestId)
      })
    }
  },
)

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
import { createProvider } from "./providers/factory"
import { extractOutputUrls } from "./providers/utils"
import type { SubmitPayload } from "./providers/type"
import {
  providerCostToActualCredits,
  providerCostToCredits,
} from "./generators/cost-utils"
import { getErrorMessage } from "@/utils/get-error-message"
import {
  limiter,
  pollWithSticky,
  resolveAndAcquire,
  submitWithFailover,
  type StickyDecision,
} from "@/features/routing"
import {
  MediaAccountError,
  MediaRateLimitError,
  MediaServiceUnavailableError,
} from "./errors"
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
        await limiter.releaseByRequestId(data.requestId, { outcome: "none" })
        await finalizeGenerationRequest(data.requestId, "failed")
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
      organizationId,
      userId,
      model,
      payload,
      mediaType,
    } = data
    const overheadRate = mediaOverheadRate(mediaType)
    const reservationTtlMs = mediaReservationTtlMs(mediaType)
    const pollInterval = mediaPollInterval(mediaType)

    const requestPayload = payload

    const decision = await step.run("resolve-route", async () => {
      try {
        const { modelId, ...payload } = requestPayload
        return await resolveAndAcquire({
          modelId: (modelId as string) || model,
          requestId,
          payload,
          leaseTtlMs: reservationTtlMs,
        })
      } catch (error) {
        wrapNonRetryable(error)
      }
    })

    let sticky: StickyDecision | undefined
    try {
      const reservation = await step.run("reserve-credits", async () => {
        try {
          const priceUSD = await estimateCatalogMediaCostUsd(
            decision.modelId,
            requestPayload,
          )
          const estimatedCredits = providerCostToCredits(priceUSD, {
            overheadRate,
          })
          const res = await billingService.reserve({
            organizationId,
            userId,
            operation: `media:${mediaType}`,
            estimatedCredits,
            ttlMs: reservationTtlMs,
            id: data._reservationId,
            idempotencyKey: `media:${requestId}:${model}:${decision.vendorName}`,
            metadata: {
              requestId,
              projectId,
              kind: mediaType,
              model,
              vendor: decision.vendorName,
            },
          })
          return {
            id: res.id,
            estimatedCredits: estimatedCredits.toString(),
            priceUSD,
          }
        } catch (error) {
          wrapNonRetryable(error)
        }
      })

      try {
        sticky = await step.run("submit-job", async () => {
          try {
            const provider = createProvider(
              decision.adapter,
              decision.vendorName,
            )
            const submitted = await provider.submitRequest(
              decision.apiName,
              decision.mappedPayload,
            )
            await limiter.release(decision.vendorName, requestId, {
              outcome: "submit_ok",
              cooldownMs: decision.cooldownMs,
            })
            const result: StickyDecision = {
              ...decision,
              providerRequestId: submitted.requestId,
            }
            await repo.patchRequestRouting(requestId, {
              vendorName: result.vendorName,
              apiName: result.apiName,
              providerRequestId: result.providerRequestId,
            })
            return result
          } catch (error) {
            if (
              error instanceof MediaRateLimitError ||
              error instanceof MediaServiceUnavailableError ||
              error instanceof MediaAccountError
            ) {
              await limiter.release(decision.vendorName, requestId, {
                outcome: "failure",
                retryAfterMs:
                  error instanceof MediaRateLimitError
                    ? error.retryAfterMs
                    : undefined,
                cooldownMs: decision.cooldownMs,
              })
              const result = await submitWithFailover({
                modelId: model,
                requestId,
                payload: requestPayload,
                leaseTtlMs: reservationTtlMs,
                exclude: [decision.vendorName],
              })
              await repo.patchRequestRouting(requestId, {
                vendorName: result.vendorName,
                apiName: result.apiName,
                providerRequestId: result.providerRequestId,
              })
              return result
            }
            await limiter.release(decision.vendorName, requestId, {
              outcome: "none",
              cooldownMs: decision.cooldownMs,
            })
            wrapNonRetryable(error)
          }
        })
      } catch (error) {
        wrapNonRetryable(error)
      }

      let resultData: unknown = null

      for (let attempt = 0; attempt < MAX_MEDIA_POLL_ATTEMPTS; attempt++) {
        await step.sleep(`wait-for-media-${attempt}`, pollInterval)

        await step.run(`renew-reservation-${attempt}`, async () => {
          await billingService.renewIfNearExpiry(
            reservation.id,
            reservationTtlMs,
          )
        })

        const pollResult = await step.run(`poll-media-${attempt}`, async () => {
          try {
            return await pollWithSticky(sticky!)
          } catch (error) {
            wrapNonRetryable(error)
          }
        })

        if (pollResult.status === "completed") {
          resultData = "data" in pollResult ? pollResult.data : null
          break
        }

        if (isTerminalFailureStatus(String(pollResult.status))) {
          await step.run("refund-on-provider-failure", () =>
            safeRefund(billingService, reservation.id, "media-provider-failed"),
          )
          await step.run("mark-error-on-provider-failure", () =>
            finalizeGenerationRequest(requestId, "failed"),
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
        await step.run("refund-on-timeout-or-empty", () =>
          safeRefund(
            billingService,
            reservation.id,
            resultData ? "media-no-valid-urls" : "media-poll-timeout",
          ),
        )
        await step.run("mark-error-on-timeout-or-empty", () =>
          finalizeGenerationRequest(requestId, "failed"),
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

      await step.run("settle-credits", () =>
        billingService.settle({
          reservationId: reservation.id,
          actualCredits: providerCostToActualCredits(reservation.priceUSD, {
            overheadRate,
          }),
          metadata: {
            requestId,
            providerCostUsd: reservation.priceUSD,
            vendor: sticky?.vendorName,
          },
        }),
      )

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

      return { requestId, assets, reservationId: reservation.id }
    } finally {
      await step.run("release-slot", async () => {
        if (sticky) {
          await limiter.release(sticky.vendorName, requestId, {
            outcome: "none",
          })
          return
        }
        await limiter.releaseByRequestId(requestId, { outcome: "none" })
      })
    }
  },
)

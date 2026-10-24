import { InternalServerError } from "../error"
import { randomUUID } from "node:crypto"
import { CapacityLeaseStore } from "@/features/capacity/lease-store"
import { parseRetryAfterHeader } from "@/features/capacity/retry-after"
import {
  releaseCapacityLease,
  tryAcquireCapacity,
} from "@/features/capacity/router"
import {
  acquireUserSlot,
  releaseUserSlot,
  UserConcurrencyLimitError,
  userLimitToHttp,
} from "@/features/capacity/user-gate"

export type YoutubeScreenshotRequest = {
  youtubeUrl: string
  seconds?: number
}

export async function captureYoutubeScreenshot(
  input: YoutubeScreenshotRequest,
  userId: string,
  store?: CapacityLeaseStore,
): Promise<Response> {
  const workerUrl = process.env.YOUTUBE_SCREENSHOT_WORKER_URL
  const token = process.env.YOUTUBE_SCREENSHOT_TOKEN
  if (!workerUrl || !token) {
    throw new InternalServerError(
      "YouTube screenshot service is not configured",
    )
  }

  const holderId = randomUUID()
  let userLease: Awaited<ReturnType<typeof acquireUserSlot>>
  try {
    userLease = await acquireUserSlot({
      userId,
      holderId,
      task: "youtube.screenshot",
      leaseTtlMs: 60_000,
      store,
    })
  } catch (error) {
    if (error instanceof UserConcurrencyLimitError) {
      return userLimitToHttp(error).toResponse()
    }
    throw error
  }

  try {
    const acquired = await tryAcquireCapacity({
      task: "youtube.screenshot",
      holderId,
      leaseTtlMs: 60_000,
      store,
    })
    if (!acquired.ok) {
      if (acquired.reason === "saturated") {
        return Response.json(
          { error: "Screenshot capacity reached; retry later" },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(acquired.retryAfterMs / 1000)),
            },
          },
        )
      }
      return Response.json(
        { error: "YouTube screenshot service is unavailable" },
        { status: 503 },
      )
    }

    let response: Response | undefined
    try {
      try {
        response = await fetch(
          `${workerUrl.replace(/\/$/, "")}/v1/youtube-screenshots`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(45000),
          },
        )
      } catch {
        return Response.json(
          { error: "YouTube screenshot service is unavailable" },
          { status: 502 },
        )
      }

      if (response.ok) return Response.json(await response.json())

      const status = [400, 422, 429, 504].includes(response.status)
        ? response.status
        : 502
      const fallback =
        status === 429
          ? "Screenshot capacity reached; retry later"
          : status === 504
            ? "Timed out capturing the YouTube screenshot"
            : status === 422
              ? "This YouTube video could not be captured"
              : status === 400
                ? "Invalid YouTube screenshot request"
                : "YouTube screenshot service failed"
      return Response.json(
        { error: fallback },
        {
          status,
          headers:
            status === 429
              ? { "Retry-After": response.headers.get("Retry-After") ?? "5" }
              : undefined,
        },
      )
    } finally {
      await releaseCapacityLease(
        acquired.selection.lease,
        response?.status === 429 ? "rate_limited" : "completed",
        {
          retryAfterMs:
            response?.status === 429
              ? parseRetryAfterHeader(response.headers.get("Retry-After") ?? "")
              : undefined,
          cooldownMs: acquired.selection.account.limits.cooldownMs,
        },
        store,
      )
    }
  } finally {
    await releaseUserSlot(userLease, store)
  }
}

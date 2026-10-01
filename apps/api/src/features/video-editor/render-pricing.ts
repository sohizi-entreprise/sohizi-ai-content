import {
  CREDIT_RATE,
  ESTIMATE_OVERBOOKING_FACTOR,
  VIDEO_OVERHEAD_RATE,
} from "@/features/billing/constants"

/** Conservative Lambda-ms charged per output frame (workers + orchestrator). */
export const MS_PER_FRAME = 300
/**
 * Renderer Lambdas launched for one export.
 *
 * Remotion invokes every chunk at once. New AWS accounts often have a
 * concurrency quota of 10, and the launch function needs a slot of its own,
 * so the default stays at the value Remotion recommends for that quota.
 * Raise it with REMOTION_CONCURRENCY after the account limit is increased.
 */
export const DEFAULT_RENDER_CONCURRENCY = 8
/** Remotion refuses renders that would spawn more than this many functions. */
export const MAX_RENDER_CONCURRENCY = 200
/** Matches Remotion's minimum frames per Lambda function. */
export const MIN_FRAMES_PER_LAMBDA = 5
export const DEFAULT_LAMBDA_MEMORY_MB = 2048
export const DEFAULT_LAMBDA_DISK_MB = 2048
export const DEFAULT_LAMBDA_REGION = "us-east-1"
export const RENDER_RESERVATION_TTL_MS = 60 * 60 * 1000

export type LambdaFunctionSpec = {
  memorySizeInMb: number
  diskSizeInMb: number
  region: string
}

export function clampRenderConcurrency(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RENDER_CONCURRENCY
  return Math.min(MAX_RENDER_CONCURRENCY, Math.max(1, Math.trunc(value)))
}

/**
 * Same split Remotion uses when `concurrency` is set: chunks stay at or under
 * the cap, and each chunk still has at least MIN_FRAMES_PER_LAMBDA frames.
 */
export function framesPerLambdaForDuration(
  durationInFrames: number,
  concurrency: number = DEFAULT_RENDER_CONCURRENCY,
): number {
  const frames = Math.max(0, Math.trunc(durationInFrames))
  if (frames === 0) return MIN_FRAMES_PER_LAMBDA
  const minimum = Math.min(MIN_FRAMES_PER_LAMBDA, frames)
  const perLambda = Math.ceil(frames / clampRenderConcurrency(concurrency))
  return Math.max(perLambda, minimum)
}

export function chunkCountForDuration(
  durationInFrames: number,
  concurrency: number = DEFAULT_RENDER_CONCURRENCY,
): number {
  const frames = Math.max(0, Math.trunc(durationInFrames))
  if (frames === 0) return 0
  return Math.ceil(frames / framesPerLambdaForDuration(frames, concurrency))
}

/** Worker chunks plus the orchestrator function. */
export function lambdasInvokedForDuration(
  durationInFrames: number,
  concurrency: number = DEFAULT_RENDER_CONCURRENCY,
): number {
  return chunkCountForDuration(durationInFrames, concurrency) + 1
}

export function estimatedLambdaDurationMs(durationInFrames: number): number {
  return Math.max(1, durationInFrames) * MS_PER_FRAME
}

/**
 * Convert a Remotion Lambda USD estimate into credits.
 *
 * Uses the video overhead and, for reserves, the shared overbooking factor.
 * Does not apply the AI-generation retail margin.
 */
export function lambdaUsdToCredits(
  providerCostUsd: number,
  options: { overbook: boolean },
): bigint {
  const loaded = Math.max(0, providerCostUsd) * (1 + VIDEO_OVERHEAD_RATE)
  const baseCredits = Math.ceil(loaded / CREDIT_RATE)
  const factor = options.overbook ? ESTIMATE_OVERBOOKING_FACTOR : 1
  return BigInt(Math.max(Math.ceil(baseCredits * factor), 1))
}

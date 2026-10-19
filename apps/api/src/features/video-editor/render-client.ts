import {
  deleteRender,
  estimatePrice,
  getRenderProgress,
  LambdaClientInternals,
  presignUrl,
  renderMediaOnLambda,
  type AwsRegion,
} from "@remotion/lambda-client"
import { BadRequest, InternalServerError } from "../error"
import { logSentryWarning } from "@/sentry"
import {
  clampRenderConcurrency,
  DEFAULT_LAMBDA_DISK_MB,
  DEFAULT_LAMBDA_MEMORY_MB,
  DEFAULT_LAMBDA_REGION,
  DEFAULT_RENDER_CONCURRENCY,
  estimatedLambdaDurationMs,
  framesPerLambdaForDuration,
  lambdasInvokedForDuration,
  type LambdaFunctionSpec,
} from "./render-pricing"
import type { RenderComposition } from "./render-schema"

/**
 * Remotion Lambda adapter. AWS credentials are read from
 * REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY.
 */

const DOWNLOAD_URL_TTL_SECONDS = 15 * 60
const MAIN_COMPOSITION_ID = "main"

export type RemoteRenderStatus =
  "queued" | "rendering" | "completed" | "failed" | "cancelled"

export type RemoteRenderJob = {
  jobId: string
  status: RemoteRenderStatus
  progress: number
  renderedFrames: number
  frameCount: number
  outputKey?: string
  outputBucket?: string
  functionName?: string
  sizeInBytes?: number
  accruedCostUsd?: number
  error?: { code: string; message: string }
  /** Progress could not be fetched; keep the last known job state. */
  stale?: boolean
}

export type RenderCostEstimate = {
  costUsd: number
  concurrency: number
  framesPerLambda: number
  lambdasInvoked: number
} & LambdaFunctionSpec

type LambdaConfig = {
  region: AwsRegion
  functionName: string
  serveUrl: string
}

type RenderRefs = {
  bucketName?: string | null
  functionName?: string | null
}

let functionSpecPromise: Promise<LambdaFunctionSpec> | null = null

function getRegion(): AwsRegion {
  return (process.env.REMOTION_AWS_REGION ?? DEFAULT_LAMBDA_REGION) as AwsRegion
}

function getConfig(): LambdaConfig {
  const functionName = process.env.REMOTION_FUNCTION_NAME
  const serveUrl = process.env.REMOTION_SERVE_URL

  if (!functionName || !serveUrl) {
    console.error("REMOTION_FUNCTION_NAME or REMOTION_SERVE_URL is not set")
    throw new InternalServerError("Rendering is not configured")
  }

  return { region: getRegion(), functionName, serveUrl }
}

export function parseAllowedMediaHosts(): string[] {
  return (process.env.RENDER_ALLOWED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0)
}

async function loadFunctionSpec(): Promise<LambdaFunctionSpec> {
  const { region, functionName } = getConfig()
  const parsed = LambdaClientInternals.parseFunctionName(functionName)
  return {
    region,
    memorySizeInMb: readPositiveInt(
      process.env.REMOTION_FUNCTION_MEMORY_MB,
      parsed?.memorySizeInMb ?? DEFAULT_LAMBDA_MEMORY_MB,
    ),
    diskSizeInMb: readPositiveInt(
      process.env.REMOTION_FUNCTION_DISK_MB,
      parsed?.diskSizeInMb ?? DEFAULT_LAMBDA_DISK_MB,
    ),
  }
}

function getFunctionSpec(): Promise<LambdaFunctionSpec> {
  functionSpecPromise ??= loadFunctionSpec()
  return functionSpecPromise
}

function getRenderConcurrency(): number {
  const raw = process.env.REMOTION_CONCURRENCY
  if (raw === undefined || raw.trim() === "") return DEFAULT_RENDER_CONCURRENCY
  return clampRenderConcurrency(Number(raw))
}

export async function estimateRenderCost(
  composition: RenderComposition,
): Promise<RenderCostEstimate> {
  const spec = await getFunctionSpec()
  const concurrency = getRenderConcurrency()
  const framesPerLambda = framesPerLambdaForDuration(
    composition.durationInFrames,
    concurrency,
  )
  const lambdasInvoked = lambdasInvokedForDuration(
    composition.durationInFrames,
    concurrency,
  )
  const costUsd = estimatePrice({
    region: spec.region as AwsRegion,
    durationInMilliseconds: estimatedLambdaDurationMs(
      composition.durationInFrames,
      composition.width,
      composition.height,
    ),
    memorySizeInMb: spec.memorySizeInMb,
    diskSizeInMb: spec.diskSizeInMb,
    lambdasInvoked,
  })

  return {
    costUsd,
    concurrency,
    framesPerLambda,
    lambdasInvoked,
    ...spec,
  }
}

export async function createRemoteRender(input: {
  jobId: string
  projectId: string
  compositionId: string
  fileName: string
  composition: RenderComposition
  concurrency: number
}): Promise<RemoteRenderJob> {
  const { region, functionName, serveUrl } = getConfig()

  try {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: MAIN_COMPOSITION_ID,
      inputProps: {
        tracks: input.composition.tracks,
        fps: input.composition.fps,
        width: input.composition.width,
        height: input.composition.height,
        durationInFrames: input.composition.durationInFrames,
      },
      codec: "h264",
      imageFormat: "jpeg",
      privacy: "private",
      concurrency: input.concurrency,
      maxRetries: 1,
      downloadBehavior: {
        type: "download",
        fileName: input.fileName,
      },
    })

    return {
      jobId: renderId,
      status: "queued",
      progress: 0,
      renderedFrames: 0,
      frameCount: input.composition.durationInFrames,
      outputBucket: bucketName,
      functionName,
    }
  } catch (error) {
    throw toRenderError(error, "Could not start the render")
  }
}

export async function getRemoteRender(
  renderId: string,
  refs: RenderRefs = {},
): Promise<RemoteRenderJob | null> {
  const bucketName = refs.bucketName
  const functionName = refs.functionName ?? process.env.REMOTION_FUNCTION_NAME
  if (!bucketName || !functionName) return null

  const region = getRegion()

  try {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region,
      // Read progress.json from S3 so polling does not compete with
      // renderer Lambdas for the account concurrency quota.
      skipLambdaInvocation: true,
    })
    return toRemoteJob(renderId, bucketName, functionName, progress)
  } catch (error) {
    if (isTransientProgressError(error)) {
      logSentryWarning("Render progress temporarily unavailable", {
        render_id: renderId,
      })
      console.warn("[render] getRenderProgress throttled, will retry", renderId)
      return {
        jobId: renderId,
        status: "rendering",
        progress: 0,
        renderedFrames: 0,
        frameCount: 0,
        outputBucket: bucketName,
        functionName,
        stale: true,
      }
    }
    console.error("[render] getRenderProgress failed", renderId, error)
    return null
  }
}

export async function cancelRemoteRender(
  renderId: string,
  refs: RenderRefs = {},
): Promise<void> {
  const bucketName = refs.bucketName
  if (!bucketName) return

  const region = getRegion()
  try {
    await deleteRender({
      region,
      bucketName,
      renderId,
    })
  } catch (error) {
    console.error("[render] deleteRender failed", renderId, error)
  }
}

export async function presignRenderOutput(input: {
  bucketName: string
  objectKey: string
  fileName: string
}): Promise<{ url: string }> {
  const region = getRegion()
  const url = await presignUrl({
    region,
    bucketName: input.bucketName,
    objectKey: input.objectKey,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    checkIfObjectExists: false,
  })

  if (!url) {
    throw new InternalServerError("Could not sign the render download")
  }

  return { url }
}

function toRemoteJob(
  renderId: string,
  bucketName: string,
  functionName: string,
  progress: Awaited<ReturnType<typeof getRenderProgress>>,
): RemoteRenderJob {
  const frameCount = frameCountFromProgress(progress)
  const renderedFrames = progress.framesRendered ?? 0
  const accruedCostUsd = progress.costs?.accruedSoFar

  if (progress.fatalErrorEncountered) {
    const first = progress.errors?.[0]
    return {
      jobId: renderId,
      status: "failed",
      progress: progress.overallProgress ?? 0,
      renderedFrames,
      frameCount,
      outputBucket: bucketName,
      functionName,
      accruedCostUsd,
      error: {
        code: "render_failed",
        message: publicRenderError(first?.message),
      },
    }
  }

  if (progress.done) {
    if (!progress.outKey) {
      return {
        jobId: renderId,
        status: "failed",
        progress: 1,
        renderedFrames,
        frameCount,
        outputBucket: bucketName,
        functionName,
        accruedCostUsd,
        error: {
          code: "missing_output",
          message: "The render finished without producing a file",
        },
      }
    }
    return {
      jobId: renderId,
      status: "completed",
      progress: 1,
      renderedFrames,
      frameCount,
      outputKey: progress.outKey,
      outputBucket: bucketName,
      functionName,
      sizeInBytes: progress.outputSizeInBytes ?? undefined,
      accruedCostUsd,
    }
  }

  const started = (progress.lambdasInvoked ?? 0) > 0 || renderedFrames > 0
  return {
    jobId: renderId,
    status: started ? "rendering" : "queued",
    progress: progress.overallProgress ?? 0,
    renderedFrames,
    frameCount,
    outputBucket: bucketName,
    functionName,
    accruedCostUsd,
  }
}

function frameCountFromProgress(
  progress: Awaited<ReturnType<typeof getRenderProgress>>,
): number {
  const metadata = progress.renderMetadata
  if (!metadata || metadata.type !== "video") return 0
  const [start, end] = metadata.frameRange
  return end - start + 1
}

function isTransientProgressError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : String(error)
  const reason =
    typeof error === "object" && error && "Reason" in error
      ? String((error as { Reason?: unknown }).Reason)
      : ""
  return (
    name === "TooManyRequestsException" ||
    reason === "ConcurrentInvocationLimitExceeded" ||
    /rate exceeded|too many requests|throttl/i.test(message)
  )
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.trunc(parsed)
}

function publicRenderError(message: string | undefined): string {
  const withoutStack = (message ?? "").replace(/\s+at \S+.*$/s, "").trim()
  if (
    /concurrency limit reached|rate exceeded|ConcurrentInvocationLimitExceeded/i.test(
      withoutStack,
    )
  ) {
    return "The export service is at capacity. Please try again in a moment."
  }
  const line = withoutStack.split("\n")[0]?.trim()
  return line || "The render failed"
}

function toRenderError(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : fallback
  if (/input props|composition|validation|cannot be rendered/i.test(message)) {
    return new BadRequest(`This composition cannot be rendered: ${message}`)
  }
  return new InternalServerError(fallback)
}

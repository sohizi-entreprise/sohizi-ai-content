import modelsTracker from "@/catalog/models-tracker"
import { billingService } from "@/features/billing"
import { withBillingStream } from "@/features/billing/wrapper"
import { readStreamChunks } from "@/features/generation-request/stream-handler"
import { generateAsset } from "@/features/media-engine/service"
import { captureYoutubeScreenshot } from "@/features/media-engine/youtube-screenshot"
import { assertProjectAccess } from "@/lib/authorize"
import {
  attachAssetToFileNode,
  getAssetById,
  getModelSchema,
  listGenerationModels,
} from "@/features/media-engine/repo"
import { normalizeFileName, toApiPath } from "@/features/file-system/utils"
import { getErrorMessage } from "@/utils/get-error-message"
import type { ModelMessage } from "ai"
import type { AgentStateManager } from "../../core/state-manager"
import { estimateInputTokens } from "../../utils/estimate-token"
import { createBillableLlmClient } from "../../utils/llm-client"
import type { ToolExecutionOptions, ToolResult } from "../tool-definition"
import { buildJobWaitOutput, isTerminalGenerationStatus } from "../job-status"
import { syncJobFromRequest } from "../job-sync"
import { validateInput } from "../validate-model-params"
import { failure, success } from "../utils"
import type { ApiMediaOperationsRequest } from "./schema"

const ANALYSIS_MAX_OUTPUT_TOKENS = 2000
const VIDEO_ANALYSIS_MAX_DURATION_SECONDS = 20 * 60
const JOB_POLL_INTERVAL_MS = 2000

type ModelSchema = Awaited<ReturnType<typeof getModelSchema>>
type RequestFor<Endpoint extends ApiMediaOperationsRequest["endpoint"]> =
  Extract<ApiMediaOperationsRequest, { endpoint: Endpoint }>

export async function executeListModels(
  data: RequestFor<"/media/models">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  try {
    const models = await listGenerationModels(data.params.type)
    const formattedModels = models.map((model) => ({
      id: model.id,
      selectionGuidance: model.selectionGuidance?.join("\n"),
    }))
    if (models.length === 0) {
      return success(
        "No models found for the given media type. No need to continue if no models are available for the given media type.",
      )
    }
    return success(JSON.stringify(formattedModels))
  } catch (error) {
    return failure(
      getErrorMessage(error, "An error occurred while listing models"),
    )
  }
}

export async function executeGetModelSchema(
  data: RequestFor<"/media/models/schema">,
  { artifacts }: ToolExecutionOptions,
): Promise<ToolResult> {
  try {
    const schema = await getModelSchema(data.params.modelId)
    artifacts.set(`schema-${data.params.modelId}`, schema)
    const formattedSchema = `
  <prompting_guidance>
    ${schema.promptingTechnics?.join("\n")}
  </prompting_guidance>
  <parameters_schema>
    ${JSON.stringify(schema.parameters)}
  </parameters_schema>
    `
    return success(formattedSchema)
  } catch (error) {
    return failure(
      getErrorMessage(
        error,
        "An error occurred while getting the model schema",
      ),
    )
  }
}

export function executeImageAnalysis(
  data: RequestFor<"/media/analyze/image">,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  return runAnalysis(
    modelsTracker.imageAnalyzer,
    buildImageInput(data.body),
    options,
  )
}

export function executeVideoAnalysis(
  data: RequestFor<"/media/analyze/video">,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  return runAnalysis(
    modelsTracker.videoAnalyzer,
    buildVideoInput(data.body),
    options,
  )
}

export function executeYoutubeAnalysis(
  data: RequestFor<"/media/analyze/youtube">,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  return runAnalysis(
    modelsTracker.youtubeAnalyzer,
    buildYoutubeInput(data.body),
    options,
  )
}

export async function executeYoutubeScreenshot(
  data: RequestFor<"/media/extract-frame/youtube">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  try {
    await assertProjectAccess(session.userId, session.projectId)
    const response = await captureYoutubeScreenshot(data.body, session.userId)
    const result: unknown = await response.json()

    if (response.ok) return success(JSON.stringify(result))

    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Failed to capture the YouTube screenshot"
    const retryAfter = response.headers.get("Retry-After")
    return failure(
      retryAfter ? `${message}. Retry after ${retryAfter} seconds.` : message,
    )
  } catch (error) {
    return failure(
      getErrorMessage(error, "Failed to capture the YouTube screenshot"),
    )
  }
}

export async function executeSubmitGeneration(
  data: RequestFor<"/media/assets/generate">,
  { session, state, artifacts, toolCallId }: ToolExecutionOptions,
): Promise<ToolResult> {
  const input = data.body
  try {
    let schema = artifacts.get(`schema-${input.modelId}`) as
      ModelSchema | undefined
    if (!schema) {
      schema = await getModelSchema(input.modelId)
      artifacts.set(`schema-${input.modelId}`, schema)
    }

    const validation = validateInput(schema, input.parameters)
    if (!validation.isValid) {
      return failure(
        `Validation failed. ${validation.errorMsg} Fix the parameters and call /media/assets/generate again.`,
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
}

export async function executeSaveAsset(
  data: RequestFor<"/media/assets/save">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { fileName, directoryPath, assetId } = data.body
  try {
    const directory = await session.resolveFileByPathOrId(directoryPath)
    if (!directory) {
      return failure(`Directory ${directoryPath} not found`)
    }
    if (!directory.isDirectory) {
      return failure(`Path "${directoryPath}" is not a directory`)
    }
    if (directory.isSkillFolder) {
      return failure("Cannot save media assets inside a skill folder")
    }

    const normalizedName = normalizeFileName(fileName)
    if (!normalizedName) {
      return failure("Invalid file name")
    }

    const asset = await getAssetById(session.projectId, assetId)
    if (!asset) {
      return failure(`Asset ${assetId} not found`)
    }
    if (asset.fileNodeId) {
      const existingFile = await session.resolveFileByPathOrId(asset.fileNodeId)
      if (existingFile) {
        return failure(
          `Asset ${assetId} is already saved at ${toApiPath(existingFile.path)}`,
        )
      }
    }

    const { fileNode, asset: attachedAsset } = await attachAssetToFileNode({
      projectId: session.projectId,
      assetId,
      folderId: directory.id,
      fileName: normalizedName,
    })

    return success(
      JSON.stringify({
        fileId: fileNode.id,
        name: fileNode.name,
        path: toApiPath(fileNode.path),
        type: fileNode.type,
        format: fileNode.format,
        assetId: attachedAsset.id,
        url: attachedAsset.url,
      }),
      [{ type: "refresh", fileId: directory.id, fileName: directory.name }],
    )
  } catch (error) {
    return failure(
      getErrorMessage(
        error,
        `Failed to save asset ${assetId} in "${directoryPath}"`,
      ),
    )
  }
}

export async function executeWaitForJob(
  data: RequestFor<"/media/jobs/wait">,
  { session, state, abortSignal }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { jobId } = data.body
  try {
    const tracked = state.getJob(jobId)
    if (
      (tracked?.status === "completed" && tracked.result) ||
      tracked?.status === "failed"
    ) {
      state.markJobsNotified([jobId])
      const output = buildJobWaitOutput(tracked)
      return tracked.status === "failed"
        ? failure(JSON.stringify(output))
        : success(JSON.stringify(output))
    }

    const settled = await waitUntilTerminal(
      session.projectId,
      jobId,
      state,
      abortSignal,
    )
    if (!settled) return failure(`Job ${jobId} not found`)

    const output = buildJobWaitOutput(settled.job, settled.request)
    return output.status === "failed"
      ? failure(JSON.stringify(output))
      : success(JSON.stringify(output))
  } catch (error) {
    return failure(getErrorMessage(error, `Failed to wait for job ${jobId}`))
  }
}

export async function executeGetJobStatus(
  data: RequestFor<"/media/jobs/status">,
  { session, state }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { jobId } = data.params
  try {
    const resolved = await syncJobFromRequest(session.projectId, jobId, state)
    if (resolved) {
      return success(
        JSON.stringify(buildJobWaitOutput(resolved.job, resolved.request)),
      )
    }

    const tracked = state.getJob(jobId)
    if (!tracked) return failure(`Job ${jobId} not found`)
    return success(JSON.stringify(buildJobWaitOutput(tracked)))
  } catch (error) {
    return failure(
      getErrorMessage(error, `Failed to get status for job ${jobId}`),
    )
  }
}

async function runAnalysis(
  modelId: string,
  messages: ModelMessage[],
  { session, abortSignal }: ToolExecutionOptions,
): Promise<ToolResult> {
  try {
    const model = await session.resolveModel(modelId)
    if (!model)
      return failure(`Model ${modelId} not found in the current session`)

    const billedStream = withBillingStream(
      createBillableLlmClient({
        model,
        modelConfig: {
          maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
          reasoningEffort: "low",
        },
      }),
      billingService,
    )(
      {
        messages,
        estimatedInputTokens: estimateInputTokens(messages, 1.15),
        estimatedOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
      },
      {
        organizationId: session.organizationId,
        userId: session.userId,
        signal: abortSignal,
        metadata: {
          sessionId: session.id,
          conversationId: session.conversationId,
          conversationRunId: session.runId,
          runId: session.runId,
        },
      },
    )

    for await (const chunk of billedStream) {
      if (chunk.type === "error") console.error("error", chunk.error)
      if (chunk.type !== "complete") continue

      if (chunk.finishReason === "content-filter") {
        return failure(
          "Content filter violation stopped the model. The file provided may contain sensitive content.",
        )
      }
      if (chunk.finishReason === "error") {
        return failure(
          chunk.error || "An unknown error occurred while executing the tool",
        )
      }
      return success(chunk.text || "")
    }

    return failure("An error occurred while executing the tool")
  } catch (error) {
    return failure(
      getErrorMessage(error, "An error occurred while analyzing media"),
    )
  }
}

function buildImageInput(
  data: RequestFor<"/media/analyze/image">["body"],
): ModelMessage[] {
  return [
    { role: "system", content: "" },
    {
      role: "user",
      content: [
        { type: "text", text: data.instructions },
        { type: "image", image: data.url },
      ],
    },
  ]
}

function buildVideoInput(
  data: RequestFor<"/media/analyze/video">["body"],
): ModelMessage[] {
  const { startOffset, endOffset } = analysisWindow(data)
  return [
    {
      role: "system",
      content:
        "Analyze a video file by its URL and return a summary based on the instructions provided",
    },
    {
      role: "user",
      content: [
        { type: "text", text: data.instructions },
        {
          type: "file",
          data: data.url,
          mediaType: data.contentType,
          providerOptions: videoMetadata(startOffset, endOffset),
        },
      ],
    },
  ]
}

function buildYoutubeInput(
  data: RequestFor<"/media/analyze/youtube">["body"],
): ModelMessage[] {
  const { startOffset, endOffset } = analysisWindow(data)
  return [
    {
      role: "system",
      content:
        "You are a helpful assistant that analyzes YouTube videos and returns a summary based on the instructions provided",
    },
    {
      role: "user",
      content: [
        { type: "text", text: data.instructions },
        {
          type: "file",
          data: cleanYoutubeUrl(data.url),
          mediaType: "video/mp4",
          providerOptions: videoMetadata(startOffset, endOffset),
        },
      ],
    },
  ]
}

function analysisWindow(data: { startSeconds?: number; endSeconds?: number }) {
  const startOffset = data.startSeconds ?? 0
  return {
    startOffset,
    endOffset: Math.min(
      data.endSeconds || VIDEO_ANALYSIS_MAX_DURATION_SECONDS,
      startOffset + VIDEO_ANALYSIS_MAX_DURATION_SECONDS,
    ),
  }
}

function videoMetadata(startOffset: number, endOffset: number) {
  return {
    google: {
      videoMetadata: {
        fps: 1,
        startOffset: `${startOffset}s`,
        endOffset: `${endOffset}s`,
      },
    },
  }
}

function cleanYoutubeUrl(url: string): string {
  const decoded = url.replaceAll("&amp;", "&")
  try {
    const parsed = new URL(decoded)
    const host = parsed.hostname.replace(/^www\./, "")
    let videoId: string | null = null

    if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1).split("/")[0] || null
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      videoId = parsed.searchParams.get("v")
      if (!videoId) {
        const match = parsed.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/)
        videoId = match?.[2] ?? null
      }
    }

    if (videoId) return `https://youtu.be/${videoId}`
  } catch {
    return decoded
  }
  return decoded
}

async function waitUntilTerminal(
  projectId: string,
  jobId: string,
  state: AgentStateManager,
  abortSignal: AbortSignal,
) {
  const initial = await syncJobFromRequest(projectId, jobId, state)
  if (!initial) return null
  if (isTerminalGenerationStatus(initial.request.status)) return initial

  for await (const chunk of readStreamChunks(jobId)) {
    if (abortSignal.aborted)
      throw new Error(`Wait for job ${jobId} was aborted`)
    const event = (chunk.data as { event?: string } | undefined)?.event
    if (event === "done") break
  }

  let latest = await syncJobFromRequest(projectId, jobId, state)
  if (!latest) return null
  if (isTerminalGenerationStatus(latest.request.status)) return latest

  while (!abortSignal.aborted) {
    await delay(JOB_POLL_INTERVAL_MS)
    if (abortSignal.aborted) break
    latest = await syncJobFromRequest(projectId, jobId, state)
    if (!latest) return null
    if (isTerminalGenerationStatus(latest.request.status)) return latest
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

import { z } from "zod"

/**
 * Wire contract between the Sohizi API and this render service.
 *
 * Keep `RENDER_CONTRACT_VERSION` in step with
 * `packages/video-composition/src/render-contract.ts`; the schemas
 * below are the authoritative trust boundary for anything reaching a container.
 */
export const RENDER_CONTRACT_VERSION = 1

export const MAIN_COMPOSITION_ID = "main"

export const RENDER_LIMITS = {
  minFps: 1,
  maxFps: 120,
  minDimension: 16,
  maxDimension: 4096,
  minDurationInFrames: 1,
  maxDurationInFrames: 72_000,
  maxTracks: 100,
  maxClips: 1_000,
  maxPayloadBytes: 8 * 1024 * 1024,
} as const

const identifier = z.string().min(1).max(200)
const ratio = z.number().finite().min(-10).max(10)
const unit = z.number().finite().min(0).max(1)
const frame = z.number().int().min(0).max(RENDER_LIMITS.maxDurationInFrames)

const mediaUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"), {
    message: "Media URLs must use https",
  })

const fontWeight = z.union([
  z.literal("normal"),
  z.literal("bold"),
  z.number().int().min(1).max(1000),
])
const textAlign = z.enum(["left", "center", "right"])

const baseClip = {
  id: identifier,
  trackId: identifier,
  startFrame: frame,
  endFrame: frame,
  sourceStartFrame: frame,
  sourceDurationInFrames: frame,
}

const spatial = {
  xRatio: ratio,
  yRatio: ratio,
  widthRatio: ratio,
  heightRatio: ratio,
}

const compositionVariableSchema = z.discriminatedUnion("type", [
  z.object({
    id: identifier,
    type: z.literal("string"),
    label: z.string().max(200),
    description: z.string().max(1000).optional(),
    default: z.string().max(10_000),
    placeholder: z.string().max(500).optional(),
    maxLength: z.number().int().positive().optional(),
  }),
  z.object({
    id: identifier,
    type: z.literal("number"),
    label: z.string().max(200),
    description: z.string().max(1000).optional(),
    default: z.number().finite(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().finite().optional(),
    unit: z.string().max(20).optional(),
  }),
  z.object({
    id: identifier,
    type: z.literal("color"),
    label: z.string().max(200),
    description: z.string().max(1000).optional(),
    default: z.string().max(200),
  }),
  z.object({
    id: identifier,
    type: z.literal("boolean"),
    label: z.string().max(200),
    description: z.string().max(1000).optional(),
    default: z.boolean(),
  }),
  z.object({
    id: identifier,
    type: z.literal("enum"),
    label: z.string().max(200),
    description: z.string().max(1000).optional(),
    default: z.string().max(500),
    options: z
      .array(
        z.object({ value: z.string().max(500), label: z.string().max(200) }),
      )
      .max(100),
  }),
])

const videoClipSchema = z.object({
  ...baseClip,
  ...spatial,
  type: z.literal("video"),
  url: mediaUrl,
  fileName: z.string().max(500),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  volume: z.number().finite().min(0).max(4),
  opacity: unit,
  speed: z.number().finite().min(0.05).max(10),
  borderRadius: z.number().finite().min(0).max(1000),
})

const audioClipSchema = z.object({
  ...baseClip,
  type: z.literal("audio"),
  url: mediaUrl,
  fileName: z.string().max(500),
  volume: z.number().finite().min(0).max(4),
  speed: z.number().finite().min(0.05).max(10),
})

const textClipSchema = z.object({
  ...baseClip,
  ...spatial,
  type: z.literal("text"),
  text: z.string().max(10_000),
  fontSize: z.number().finite().min(1).max(2000),
  color: z.string().max(200),
  fontFamily: z.string().max(200),
  fontWeight,
  align: textAlign,
  opacity: unit,
})

const imageClipSchema = z.object({
  ...baseClip,
  ...spatial,
  type: z.literal("image"),
  url: mediaUrl,
  fileName: z.string().max(500),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  opacity: unit,
  borderRadius: z.number().finite().min(0).max(1000),
  blur: z.number().finite().min(0).max(200),
  brightness: z.number().finite().min(0).max(1000),
})

const htmlClipSchema = z.object({
  ...baseClip,
  ...spatial,
  type: z.literal("html"),
  html: z.string().max(2 * 1024 * 1024),
  variables: z.array(compositionVariableSchema).max(200),
  values: z.record(
    z.string().max(200),
    z.union([z.string().max(10_000), z.number().finite(), z.boolean()]),
  ),
})

const captionClipSchema = z.object({
  ...baseClip,
  type: z.literal("caption"),
  captions: z.object({
    text: z.string().max(200_000),
    words: z
      .array(
        z.object({
          word: z.string().max(200),
          start: z.number().finite().min(0),
          end: z.number().finite().min(0),
        }),
      )
      .max(50_000),
  }),
  properties: z.object({
    fontSize: z.number().finite().min(1).max(2000),
    color: z.string().max(200),
    fontFamily: z.string().max(200),
    fontWeight,
    align: textAlign,
    opacity: unit,
    xRatio: ratio,
    yRatio: ratio,
    widthRatio: ratio,
    heightRatio: ratio,
    hightlightColor: z.string().max(200).optional(),
    backgroundColor: z.string().max(200).optional(),
  }),
})

export const clipSchema = z.discriminatedUnion("type", [
  videoClipSchema,
  audioClipSchema,
  textClipSchema,
  imageClipSchema,
  htmlClipSchema,
  captionClipSchema,
])

export const trackSchema = z.object({
  id: identifier,
  type: z.enum(["video", "audio", "text", "image", "html", "caption"]),
  name: z.string().max(200),
  muted: z.boolean(),
  hidden: z.boolean(),
  clips: z.array(clipSchema).max(RENDER_LIMITS.maxClips),
})

export const compositionSchema = z.object({
  fps: z.number().int().min(RENDER_LIMITS.minFps).max(RENDER_LIMITS.maxFps),
  width: z
    .number()
    .int()
    .min(RENDER_LIMITS.minDimension)
    .max(RENDER_LIMITS.maxDimension),
  height: z
    .number()
    .int()
    .min(RENDER_LIMITS.minDimension)
    .max(RENDER_LIMITS.maxDimension),
  durationInFrames: z
    .number()
    .int()
    .min(RENDER_LIMITS.minDurationInFrames)
    .max(RENDER_LIMITS.maxDurationInFrames),
  tracks: z.array(trackSchema).max(RENDER_LIMITS.maxTracks),
})

export const createRenderRequestSchema = z.object({
  contractVersion: z.literal(RENDER_CONTRACT_VERSION),
  jobId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_][a-zA-Z0-9-_]{0,99}$/,
      "jobId must be a workflow-safe id",
    ),
  projectId: z.string().uuid(),
  compositionId: z.string().uuid(),
  fileName: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[\w \-.]+$/,
      "fileName may only contain letters, numbers, spaces, - _ .",
    ),
  composition: compositionSchema,
})

export type CreateRenderRequest = z.infer<typeof createRenderRequestSchema>
export type RenderComposition = z.infer<typeof compositionSchema>
export type RenderTrack = z.infer<typeof trackSchema>
export type RenderClip = z.infer<typeof clipSchema>

/** Payload persisted for the Workflow instance. */
export type RenderWorkflowParams = {
  jobId: string
  projectId: string
  compositionId: string
  fileName: string
  inputKey: string
  outputKey: string
  progressKey: string
  frameCount: number
}

export type RenderJobStatus =
  "queued" | "rendering" | "completed" | "failed" | "cancelled"

export type RenderJobState = {
  jobId: string
  status: RenderJobStatus
  /** 0..1, only meaningful while rendering. */
  progress: number
  renderedFrames: number
  frameCount: number
  outputKey?: string
  sizeInBytes?: number
  error?: { code: string; message: string }
}

/** Progress document the Workflow keeps in R2 so status reads stay cheap. */
export const renderProgressSchema = z.object({
  progress: z.number().min(0).max(1),
  renderedFrames: z.number().int().min(0),
  frameCount: z.number().int().min(0),
  updatedAt: z.string(),
})

export type RenderProgress = z.infer<typeof renderProgressSchema>

/** Container-side render status contract. */
export const containerRenderStatusSchema = z.object({
  jobId: z.string(),
  state: z.enum(["running", "completed", "failed"]),
  progress: z.number().min(0).max(1),
  renderedFrames: z.number().int().min(0),
  encodedFrames: z.number().int().min(0),
  sizeInBytes: z.number().int().min(0).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean().optional(),
    })
    .optional(),
})

export type ContainerRenderStatus = z.infer<typeof containerRenderStatusSchema>

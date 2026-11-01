import {
  UserContent,
  AssistantContent,
  ToolContent,
  ModelMessage,
  FinishReason,
} from "ai"
import { z } from "zod"

export type GenerationRequestStatus =
  "pending" | "processing" | "completed" | "failed" | "aborted"
export type GenerationRequestType =
  | "image"
  | "video"
  | "audio"
  | "chat-completion"
  | "media-generation"
  | "caption-generation"

export type GenerationRequestAsset = {
  assetId: string
  type: "image" | "video" | "audio" | "html"
  url: string
  name: string
}

export type ModelCategory =
  | "text-to-image"
  | "image-to-image"
  | "image-to-video"
  | "text-to-video"
  | "text-to-speech"
  | "music-generation"
  | "voice-control"
  | "motion-transfer"
  | "lip-sync"
  | "image-upscaler"
  | "video-upscaler"
  | "video-to-text"
  | "image-to-text"
  | "speech-to-text"
  | "leading-agent"
  | "video-to-video"
  | "text-to-text"

export type ModelRecommendedUsage = "lead-agent" | "summary-agent"

export type MsgContent = UserContent | AssistantContent | ToolContent

export type ModelParameterTableRate = {
  when: Record<string, string | number>
  usd: number
}

export type ModelBasePricing =
  | {
      unit: "per_1m_tokens"
      input: number
      output: number
      cached_input?: number
    }
  | {
      unit: "per_inference"
      rate: number
    }
  | {
      unit: "parameter_table"
      rate: ModelParameterTableRate[]
    }

export type VendorKind = "media" | "llm"

export type VendorRateLimit = {
  rpm: number
  burst?: number
  maxConcurrency: number
}

export type VendorCircuitConfig = {
  cooldownMs: number
  probeTtlMs: number
}

export const DEFAULT_VENDOR_RATE_LIMIT: VendorRateLimit = {
  rpm: 60,
  burst: 60,
  maxConcurrency: 10,
}

export const DEFAULT_VENDOR_CIRCUIT_CONFIG: VendorCircuitConfig = {
  cooldownMs: 15_000,
  probeTtlMs: 30_000,
}

export type TextTokenUsage = {
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
}

export type CursorPaginationOptions = {
  limit?: number
  cursor?: string
}

export type CursorPaginationResult<T> = {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export type Runstatus = "idle" | "running" | "finished" | "error" | "paused"

export type TodoItem = {
  id: string
  task: string
  status: "pending" | "in_progress" | "done"
}

export type CompleteReason = FinishReason | "abort"

export type TokenUsage = {
  input: number
  output: number
  reasoning: number
  cached: number
  total: number
  modelId: string
  cost: number
}

export type MemoryScope = "project" | "user" | "user-project"
export type MemoryLoadingPolicy = "always" | "on-demand"

export type ChatMetadata = {
  usage: TokenUsage | null
  latestRunUsage?: TokenUsage | null
}

export type AgentState = {
  jobs: AgentJob[]
  messages: ModelMessage[]
  usage: TokenUsage | null
  latestRunUsage: TokenUsage | null
  status: Runstatus
  finishReason: CompleteReason | "need-approval" | null
  error: string | null
  todos: TodoItem[]
}

export type AgentJob = {
  jobId: string // generation_requests.id
  kind: "image" | "video" | "audio" | "speech"
  status: "queued" | "running" | "completed" | "failed"
  toolCallId: string // the submit call that created it
  label: string // "hero portrait", "scene 3 vo"
  result?: string
  error?: string
  notified?: boolean
}

export type ProseNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: Array<{ type: "text"; text?: string } | ProseNode>
  text?: string
}

export type ProseDocument = { type: "doc"; content: ProseNode[] }

export type AssetType = "image" | "video" | "audio" | "document" | "html"
export type AssetSource = "user-uploaded" | "ai-generated"
export type AssetVariantType = "original" | "thumbnail" | "preview" | "delivery"
export type AssetStatus = "pending" | "processing" | "completed" | "failed"
export type ImageAssetFormat = "jpg" | "jpeg" | "png" | "gif" | "webp"
export type VideoAssetFormat = "mp4" | "mov" | "webm"
export type AudioAssetFormat = "mp3" | "wav" | "m4a"
export type DocumentAssetFormat = "pdf" | "doc" | "docx" | "txt" | "md"
export type ImageAssetMetadata = {
  format: ImageAssetFormat
  width: number
  height: number
}
export type VideoAssetMetadata = {
  format: VideoAssetFormat
  width: number
  height: number
  duration: number
}
export type AudioAssetMetadata = {
  duration: number
  format: AudioAssetFormat
}
export type DocumentAssetMetadata = {
  format: DocumentAssetFormat
}

export type AssetMetadata = {
  size: number
  contentType: string
  duration?: number
  width?: number
  height?: number
  /** HyperFrames composition variable schema (html assets) */
  variables?: CompositionVariable[]
  /** Current / default values keyed by variable id (html assets) */
  values?: Record<string, string | number | boolean>
  compositionId?: string
}

export type TemplateAndSkillStatus = "draft" | "published"
// public: visible to all users, private: visible to only the organization, app-level: displayed on the to all users in the app
export type TemplateAndSkillVisibility = "public" | "private"

export type CategoryType = "genre" | "format" | "audience" | "platform"

// ========================= VIDEO EDITOR ==========================

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5"

export type VideoTrackType = "video" | "audio" | "text" | "image" | "caption"

export type TextAlign = "left" | "center" | "right"

export type CompositionVariableType =
  "string" | "number" | "color" | "boolean" | "enum"

export type CompositionVariableBase = {
  id: string
  type: CompositionVariableType
  label: string
  description?: string
}

export type StringVariable = CompositionVariableBase & {
  type: "string"
  default: string
  placeholder?: string
  maxLength?: number
}

export type NumberVariable = CompositionVariableBase & {
  type: "number"
  default: number
  min?: number
  max?: number
  step?: number
  unit?: string
}

export type ColorVariable = CompositionVariableBase & {
  type: "color"
  default: string
}

export type BooleanVariable = CompositionVariableBase & {
  type: "boolean"
  default: boolean
}

export type EnumVariable = CompositionVariableBase & {
  type: "enum"
  default: string
  options: Array<{ value: string; label: string }>
}

export type CompositionVariable =
  | StringVariable
  | NumberVariable
  | ColorVariable
  | BooleanVariable
  | EnumVariable

export type ObjectFitMode = "contain" | "cover"
export type ClipAnimationIn = "none" | "fade" | "slide-up" | "scale-up"
export type ClipAnimationOut = "none" | "fade" | "slide-down" | "scale-down"
export type ImageMotionEffect =
  "none" | "ken-burns-in" | "ken-burns-out" | "pan-left" | "pan-right"

export type VideoMediaClipProperties = {
  url: string
  fileName: string
  width?: number
  height?: number
  volume: number
  opacity: number
  speed: number
  borderRadius: number
  blur?: number
  brightness?: number
  fit?: ObjectFitMode
  fadeInFrames?: number
  fadeOutFrames?: number
  animationIn?: ClipAnimationIn
  animationOut?: ClipAnimationOut
  xRatio?: number
  yRatio?: number
  widthRatio?: number
  heightRatio?: number
}

export type AudioMediaClipProperties = {
  url: string
  fileName: string
  volume: number
  speed: number
  fadeInFrames?: number
  fadeOutFrames?: number
}

export type TextClipProperties = {
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: string | number
  align: TextAlign
  opacity: number
  backgroundColor?: string
  backgroundOpacity?: number
  borderRadius?: number
  textShadow?: boolean
  fadeInFrames?: number
  fadeOutFrames?: number
  animationIn?: ClipAnimationIn
  animationOut?: ClipAnimationOut
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export type ImageMediaClipProperties = {
  url: string
  fileName: string
  width?: number
  height?: number
  opacity: number
  borderRadius: number
  blur: number
  brightness: number
  fit?: ObjectFitMode
  fadeInFrames?: number
  fadeOutFrames?: number
  animationIn?: ClipAnimationIn
  animationOut?: ClipAnimationOut
  motionEffect?: ImageMotionEffect
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export type CaptionWord = {
  word: string
  start: number
  end: number
}

export type CaptionClipProperties = {
  text: string
  words?: CaptionWord[]
  fontSize: number
  color?: string
  fontFamily?: string
  fontWeight?: string | number
  align?: TextAlign
  hightlightColor?: string
  backgroundColor?: string
  backgroundEnabled?: boolean
  opacity?: number
  xRatio?: number
  yRatio?: number
  widthRatio?: number
  heightRatio?: number
}

export type VideoClipProperties =
  | VideoMediaClipProperties
  | AudioMediaClipProperties
  | TextClipProperties
  | ImageMediaClipProperties
  | CaptionClipProperties

export const videoClipSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  volume: z
    .number()
    .min(0)
    .max(1)
    .describe("Audio volume from 0 to 1 (default: 1)"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .describe("Opacity from 0 to 1 (default: 1)"),
  speed: z
    .number()
    .positive()
    .describe("Playback speed multiplier (default: 1)"),
  borderRadius: z
    .number()
    .min(0)
    .describe("Corner radius in pixels (default: 0)"),
  blur: z
    .number()
    .min(0)
    .optional()
    .describe("Blur radius in pixels (default: 0)"),
  brightness: z
    .number()
    .min(0)
    .max(200)
    .optional()
    .describe(
      "Brightness percentage from 0 to 200, where 100 is normal brightness and 0 is completely black (default: 100)",
    ),
  fit: z
    .enum(["contain", "cover"])
    .optional()
    .describe(
      "Object fit mode inside the clip bounding box: 'contain' or 'cover' (default: 'contain')",
    ),
  fadeInFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the start of the clip to smoothly fade in opacity and audio volume (default: 0)",
    ),
  fadeOutFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the end of the clip to smoothly fade out opacity and audio volume (default: 0)",
    ),
  animationIn: z
    .enum(["none", "fade", "slide-up", "scale-up"])
    .optional()
    .describe("Entrance animation preset (default: 'none')"),
  animationOut: z
    .enum(["none", "fade", "slide-down", "scale-down"])
    .optional()
    .describe("Exit animation preset (default: 'none')"),
  xRatio: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Horizontal center position ratio from 0 to 1 (default: 0.5)"),
  yRatio: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Vertical center position ratio from 0 to 1 (default: 0.5)"),
  widthRatio: z
    .number()
    .positive()
    .optional()
    .describe("Width ratio relative to canvas from 0.05 to 2 (default: 1)"),
  heightRatio: z
    .number()
    .positive()
    .optional()
    .describe("Height ratio relative to canvas from 0.04 to 2 (default: 1)"),
}) satisfies z.ZodType<VideoMediaClipProperties>

export const audioClipSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  volume: z
    .number()
    .min(0)
    .max(1)
    .describe("Audio volume from 0 to 1 (default: 1)"),
  speed: z
    .number()
    .positive()
    .describe("Playback speed multiplier (default: 1)"),
  fadeInFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the start of the clip to smoothly fade in audio volume (default: 0)",
    ),
  fadeOutFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the end of the clip to smoothly fade out audio volume (default: 0)",
    ),
}) satisfies z.ZodType<AudioMediaClipProperties>

export const textClipSchema = z.object({
  text: z.string(),
  fontSize: z.number().positive().describe("Font size in pixels (default: 64)"),
  color: z.string().describe("Hex or CSS color (default: '#ffffff')"),
  fontFamily: z.string().describe("Font family name (default: 'Inter')"),
  fontWeight: z
    .union([z.string(), z.number()])
    .describe(
      "Font weight such as 'normal', 'bold', or numeric (default: 'bold')",
    ),
  align: z.enum(["left", "center", "right"]),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .describe("Opacity from 0 to 1 (default: 1)"),
  backgroundColor: z
    .string()
    .optional()
    .describe(
      "Optional background pill hex/CSS color for text legibility (e.g., '#000000')",
    ),
  backgroundOpacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Background pill opacity from 0 to 1 when backgroundColor is set (default: 0.75)",
    ),
  borderRadius: z
    .number()
    .min(0)
    .optional()
    .describe("Background pill corner radius in pixels (default: 12)"),
  textShadow: z
    .boolean()
    .optional()
    .describe(
      "Enable drop shadow behind text for readability over video/images (default: false)",
    ),
  fadeInFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the start of the clip to smoothly fade in opacity (default: 0)",
    ),
  fadeOutFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the end of the clip to smoothly fade out opacity (default: 0)",
    ),
  animationIn: z
    .enum(["none", "fade", "slide-up", "scale-up"])
    .optional()
    .describe("Entrance animation preset (default: 'none')"),
  animationOut: z
    .enum(["none", "fade", "slide-down", "scale-down"])
    .optional()
    .describe("Exit animation preset (default: 'none')"),
  xRatio: z
    .number()
    .min(0)
    .max(1)
    .describe("Horizontal center position ratio from 0 to 1 (default: 0.5)"),
  yRatio: z
    .number()
    .min(0)
    .max(1)
    .describe("Vertical center position ratio from 0 to 1 (default: 0.85)"),
  widthRatio: z
    .number()
    .positive()
    .describe("Width ratio relative to canvas (default: 0.7)"),
  heightRatio: z
    .number()
    .positive()
    .describe("Height ratio relative to canvas (default: 0.18)"),
}) satisfies z.ZodType<TextClipProperties>

export const imageClipSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .describe("Opacity from 0 to 1 (default: 1)"),
  borderRadius: z
    .number()
    .min(0)
    .describe("Corner radius in pixels (default: 0)"),
  blur: z.number().min(0).describe("Blur radius in pixels (default: 0)"),
  brightness: z
    .number()
    .min(0)
    .max(200)
    .describe(
      "Brightness percentage from 0 to 200, where 100 is normal brightness and 0 is completely black (default: 100)",
    ),
  fit: z
    .enum(["contain", "cover"])
    .optional()
    .describe(
      "Object fit mode inside the clip bounding box: 'contain' or 'cover' (default: 'contain')",
    ),
  fadeInFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the start of the clip to smoothly fade in opacity (default: 0)",
    ),
  fadeOutFrames: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Number of frames at the end of the clip to smoothly fade out opacity (default: 0)",
    ),
  animationIn: z
    .enum(["none", "fade", "slide-up", "scale-up"])
    .optional()
    .describe("Entrance animation preset (default: 'none')"),
  animationOut: z
    .enum(["none", "fade", "slide-down", "scale-down"])
    .optional()
    .describe("Exit animation preset (default: 'none')"),
  motionEffect: z
    .enum(["none", "ken-burns-in", "ken-burns-out", "pan-left", "pan-right"])
    .optional()
    .describe(
      "Continuous camera motion effect across the image clip duration (default: 'none')",
    ),
  xRatio: z
    .number()
    .min(0)
    .max(1)
    .describe("Horizontal center position ratio from 0 to 1 (default: 0.5)"),
  yRatio: z
    .number()
    .min(0)
    .max(1)
    .describe("Vertical center position ratio from 0 to 1 (default: 0.5)"),
  widthRatio: z
    .number()
    .positive()
    .describe("Width ratio relative to canvas from 0.05 to 2 (default: 1)"),
  heightRatio: z
    .number()
    .positive()
    .describe("Height ratio relative to canvas from 0.04 to 2 (default: 1)"),
}) satisfies z.ZodType<ImageMediaClipProperties>

export const captionClipSchema = z.object({
  text: z.string().describe("Full transcript text for the caption clip"),
  words: z
    .array(
      z.object({
        word: z.string(),
        start: z.number(),
        end: z.number(),
      }),
    )
    .optional()
    .describe("Word-level timing array in seconds"),
  fontSize: z.number().positive().describe("Font size in pixels (default: 48)"),
  color: z
    .string()
    .optional()
    .describe("Base word color hex/CSS (default: '#ffffff')"),
  fontFamily: z
    .string()
    .optional()
    .describe("Font family name (default: 'Inter')"),
  fontWeight: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Font weight (default: 'bold')"),
  align: z.enum(["left", "center", "right"]).optional(),
  hightlightColor: z
    .string()
    .optional()
    .describe("Active spoken word highlight color (default: '#FFD700')"),
  backgroundColor: z
    .string()
    .optional()
    .describe(
      "Background pill color behind the active word (default: 'rgba(0,0,0,0.8)')",
    ),
  backgroundEnabled: z
    .boolean()
    .optional()
    .describe(
      "Whether the active word background pill is shown (default: true)",
    ),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Opacity from 0 to 1 (default: 1)"),
  xRatio: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Horizontal center position ratio from 0 to 1 (default: 0.5)"),
  yRatio: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Vertical center position ratio from 0 to 1 (default: 0.85)"),
  widthRatio: z
    .number()
    .positive()
    .optional()
    .describe("Width ratio relative to canvas (default: 0.7)"),
  heightRatio: z
    .number()
    .positive()
    .optional()
    .describe("Height ratio relative to canvas (default: 0.18)"),
}) satisfies z.ZodType<CaptionClipProperties>

export const clipPropertiesSchemaByType = {
  video: videoClipSchema,
  audio: audioClipSchema,
  text: textClipSchema,
  image: imageClipSchema,
  caption: captionClipSchema,
} as const

export type FileOperationType = "delete" | "patch" | "refresh"

export type DeleteOperation = {
  type: "delete"
  fileId: string
  fileName: string
}

export type RefreshOperation = {
  type: "refresh"
  fileId: string
  fileName: string
}

export type PatchOperation = {
  type: "patch"
  content: string
  /**
   * Accepted markdown at the time the first pending suggestion was created.
   * Later AI edits reuse this snapshot so reject can restore (or merge against)
   * the original document instead of an intermediate proposal.
   */
  baseContent: string
  fileId: string
  fileName: string
}

export type FilePendingOperation =
  DeleteOperation | PatchOperation | RefreshOperation

export type VideoCompositionEntity = {
  id: string
  projectId: string
  fileNodeId: string | null
  fps: number
  durationInFrames: number
  aspectRatio: AspectRatio
  width: number
  height: number
  version: number
  createdAt: Date
  updatedAt: Date
}

export type VideoTrackEntity = {
  id: string
  compositionId: string
  type: VideoTrackType
  position: number
  muted: boolean
  hidden: boolean
  createdAt: Date
  updatedAt: Date
}

export type VideoClipEntity = {
  id: string
  trackId: string
  compositionId: string
  type: VideoTrackType
  startFrame: number
  endFrame: number
  sourceStartFrame: number
  sourceDurationInFrames: number
  properties: VideoClipProperties
  createdAt: Date
  updatedAt: Date
}

export type VideoEditorChange =
  | { type: "update_composition"; composition: VideoCompositionEntity }
  | { type: "add_track"; track: VideoTrackEntity; name?: string }
  | { type: "update_track"; track: VideoTrackEntity; name?: string }
  | { type: "remove_track"; trackId: string }
  | { type: "add_clip"; clip: VideoClipEntity }
  | { type: "update_clip"; clip: VideoClipEntity }
  | { type: "remove_clip"; clipId: string }

export type AgentRunStatus = "pending" | "running" | "finished" | "error"
export type AgentRunMetadata = {
  usage: TokenUsage
  vendor?: string
}

export type AgentRunMessage = ModelMessage & { id: string }

export type ModelParameterConstraint = {
  min?: number
  max?: number
  step?: number
  fileType?: "image" | "video" | "audio"
}

export type ModelParameterDataType =
  "string" | "number" | "boolean" | "array<string>" | "array<number>"
export type ModelParameterUIComponent =
  "select" | "slider" | "uploader" | "textarea" | "checkbox"

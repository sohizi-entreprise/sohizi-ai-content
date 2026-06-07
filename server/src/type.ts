import { UserContent, AssistantContent, ToolContent, ModelMessage, FinishReason } from 'ai';
import { z } from 'zod';

export type GenerationRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'aborted';
export type GenerationRequestType = 'image' | 'video' | 'audio';

export type ProjectFormat = 'storytime' | 'explainer' | 'documentary' | 'presenter';
export type Audience = 'general' | 'kids' | 'teens' | 'adult';
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night' | 'unspecified';

export type EntityType = 'CHARACTER' | 'LOCATION' | 'PROP' | 'COSTUME';

export type ModelCategory = 'text' | 'image' | 'video' | 'audio';

export type ModelRecommendedUsage = 'lead-agent' | 'summary-agent'

export type MsgContent = UserContent | AssistantContent | ToolContent

export type PricingTier = {
  up_to: number | null;
  rate: number;
}

export type TokenPricing = {
  currency: "USD";
  unit: "per_1m_tokens";
  basis?: "request_tokens" | "billable_tokens";
  input: PricingTier[];
  output: PricingTier[];
  cached_input?: PricingTier[];
}

export type TextTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export type ChatMetadata = {
  spentTokens: {
    input: number
    output: number
  }
  selectedModel?: string
}

export type CursorPaginationOptions = {
  limit?: number;
  cursor?: string;
};

export type CursorPaginationResult<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type Runstatus = 'idle' | 'running' | 'finished' | 'error' | 'aborted' | 'paused'

export type TodoItem = {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'done';
}

export type CompleteReason = FinishReason | 'abort';

export type TokenUsage = {
  input: number;
  output: number;
  reasoning: number;
  cached: number;
  total: number;
  modelId: string;
}

export type AgentState = {
  messages: ModelMessage[];
  usage: TokenUsage | null;
  status: Runstatus;
  finishReason: CompleteReason | 'need-approval' | null;
  error: string | null;
  todos: TodoItem[];
}

// export type AgentRunFinishReason = 'response' | 'error' | 'tool-calls' | 'aborted' | 'max-iterations' | 'not-finished';

export type ProseNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: Array<{ type: 'text'; text?: string } | ProseNode>
  text?: string
}

export type SceneContent = 
  | { type: 'slugline'; text: string; locationId?: string }
  | { type: 'action'; text: string }
  | { type: 'dialogue'; text: string; character: string; parenthetical?: string }
  | { type: 'transition'; text: string }

export type ProseDocument = { type: 'doc'; content: ProseNode[] }

export type AssetType = 'image' | 'video' | 'audio' | 'document';
export type AssetSource = 'user-uploaded' | 'ai-generated';
export type AssetVariantType = 'original' | 'thumbnail' | 'preview' | 'delivery';
export type AssetStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ImageAssetFormat = 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp';
export type VideoAssetFormat = 'mp4' | 'mov' | 'webm';
export type AudioAssetFormat = 'mp3' | 'wav' | 'm4a';
export type DocumentAssetFormat = 'pdf' | 'doc' | 'docx' | 'txt' | 'md'
export type ImageAssetMetadata = {
  format: ImageAssetFormat;
  width: number;
  height: number;
}
export type VideoAssetMetadata = {
  format: VideoAssetFormat;
  width: number;
  height: number;
  duration: number;
}
export type AudioAssetMetadata = {
  duration: number;
  format: AudioAssetFormat;
}
export type DocumentAssetMetadata = {
  format: DocumentAssetFormat;
}

export type AssetMetadata = {
  size: number;
  contentType: string;
  duration?: number
}

export type TemplateAndSkillStatus = 'draft' | 'published'
// public: visible to all users, private: visible to only the organization, app-level: displayed on the to all users in the app
export type TemplateAndSkillVisibility = 'public' | 'private'

export type CategoryType = 'genre' | 'format' | 'audience' | 'platform'

// ========================= VIDEO EDITOR ==========================

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'

export type VideoTrackType = 'video' | 'audio' | 'text' | 'image' | 'html' | 'caption'

export type TextAlign = 'left' | 'center' | 'right'

export type CompositionVariableType = 'string' | 'number' | 'color' | 'boolean' | 'enum'

export type CompositionVariableBase = {
  id: string
  type: CompositionVariableType
  label: string
  description?: string
}

export type StringVariable = CompositionVariableBase & {
  type: 'string'
  default: string
  placeholder?: string
  maxLength?: number
}

export type NumberVariable = CompositionVariableBase & {
  type: 'number'
  default: number
  min?: number
  max?: number
  step?: number
  unit?: string
}

export type ColorVariable = CompositionVariableBase & {
  type: 'color'
  default: string
}

export type BooleanVariable = CompositionVariableBase & {
  type: 'boolean'
  default: boolean
}

export type EnumVariable = CompositionVariableBase & {
  type: 'enum'
  default: string
  options: Array<{ value: string; label: string }>
}

export type CompositionVariable =
  | StringVariable
  | NumberVariable
  | ColorVariable
  | BooleanVariable
  | EnumVariable

export type VideoMediaClipProperties = {
  url: string
  fileName: string
  width?: number
  height?: number
  volume: number
  opacity: number
  speed: number
  borderRadius: number
}

export type AudioMediaClipProperties = {
  url: string
  fileName: string
  volume: number
  speed: number
}

export type TextClipProperties = {
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: string | number
  align: TextAlign
  opacity: number
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
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export type HtmlClipProperties = {
  html: string
  variables: CompositionVariable[]
  values: Record<string, string | number | boolean>
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
  | HtmlClipProperties
  | CaptionClipProperties

const compositionVariableBaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
})

const stringVariableSchema = compositionVariableBaseSchema.extend({
  type: z.literal('string'),
  default: z.string(),
  placeholder: z.string().optional(),
  maxLength: z.number().optional(),
}) satisfies z.ZodType<StringVariable>

const numberVariableSchema = compositionVariableBaseSchema.extend({
  type: z.literal('number'),
  default: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
}) satisfies z.ZodType<NumberVariable>

const colorVariableSchema = compositionVariableBaseSchema.extend({
  type: z.literal('color'),
  default: z.string(),
}) satisfies z.ZodType<ColorVariable>

const booleanVariableSchema = compositionVariableBaseSchema.extend({
  type: z.literal('boolean'),
  default: z.boolean(),
}) satisfies z.ZodType<BooleanVariable>

const enumVariableSchema = compositionVariableBaseSchema.extend({
  type: z.literal('enum'),
  default: z.string(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })),
}) satisfies z.ZodType<EnumVariable>

export const compositionVariableSchema = z.discriminatedUnion('type', [
  stringVariableSchema,
  numberVariableSchema,
  colorVariableSchema,
  booleanVariableSchema,
  enumVariableSchema,
]) satisfies z.ZodType<CompositionVariable>

export const videoClipSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  volume: z.number(),
  opacity: z.number(),
  speed: z.number(),
  borderRadius: z.number(),
}) satisfies z.ZodType<VideoMediaClipProperties>

export const audioClipSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  volume: z.number(),
  speed: z.number(),
}) satisfies z.ZodType<AudioMediaClipProperties>

export const textClipSchema = z.object({
  text: z.string(),
  fontSize: z.number(),
  color: z.string(),
  fontFamily: z.string(),
  fontWeight: z.union([z.string(), z.number()]),
  align: z.enum(['left', 'center', 'right']),
  opacity: z.number(),
  xRatio: z.number(),
  yRatio: z.number(),
  widthRatio: z.number(),
  heightRatio: z.number(),
}) satisfies z.ZodType<TextClipProperties>

export const imageClipSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  opacity: z.number(),
  borderRadius: z.number(),
  blur: z.number(),
  brightness: z.number(),
  xRatio: z.number(),
  yRatio: z.number(),
  widthRatio: z.number(),
  heightRatio: z.number(),
}) satisfies z.ZodType<ImageMediaClipProperties>

export const htmlClipSchema = z.object({
  html: z.string(),
  variables: z.array(compositionVariableSchema),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
}) satisfies z.ZodType<HtmlClipProperties>

export const clipPropertiesSchemaByType = {
  video: videoClipSchema,
  audio: audioClipSchema,
  text: textClipSchema,
  image: imageClipSchema,
  html: htmlClipSchema,
} as const

export type FileOperationType = 'delete' | 'patch' | 'refresh'

export type DeleteOperation = {
  type: 'delete';
  fileId: string;
  fileName: string;
}

export type RefreshOperation = {
  type: 'refresh';
  fileId: string;
  fileName: string;
}

export type PatchOperation = {
  type: 'patch';
  content: string;
  fileId: string;
  fileName: string;
}

export type FilePendingOperation = DeleteOperation | PatchOperation | RefreshOperation

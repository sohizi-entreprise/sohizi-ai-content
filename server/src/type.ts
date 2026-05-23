import { UserContent, AssistantContent, ToolContent, ModelMessage, FinishReason } from 'ai';

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
}

export type TemplateAndSkillStatus = 'draft' | 'published'
// public: visible to all users, private: visible to only the organization, app-level: displayed on the to all users in the app
export type TemplateAndSkillVisibility = 'public' | 'private'

export type CategoryType = 'genre' | 'format' | 'audience' | 'platform'

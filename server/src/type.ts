import { UserContent, AssistantContent, ToolContent, ModelMessage, FinishReason } from 'ai';

export type ProjectStatus = 'DRAFT' | 'OUTLINE_GENERATED' | 'OUTLINE_CONFIRMED' | 'SHOTS_GENERATED';
export type GenerationRequestStatus = 'ENQUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
export type GenerationRequestType = 
| 'GENERATE_SCENE' 
| 'GENERATE_ENTITY'
| 'GENERATE_CONCEPT'
| 'GENERATE_SYNOPSIS'
| 'GENERATE_STORY_BIBLE'
// | 'CHAT_COMPLETION'
;
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'narrator' | 'unknown';

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




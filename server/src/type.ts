export type ProjectStatus = 'DRAFT' | 'OUTLINE_GENERATED' | 'OUTLINE_CONFIRMED' | 'SHOTS_GENERATED';
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'narrator' | 'unknown';

export type ProjectFormat = 'storytime' | 'explainer' | 'documentary' | 'presenter';
export type Audience = 'general' | 'kids' | 'teens' | 'adult';
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night' | 'unspecified';
export type ShotType = 'establishing' | 'wide' | 'medium' | 'closeup' | 'insert';
export type ShotAngle = 'eye_level' | 'low' | 'high' | 'over_shoulder' | 'top_down';
export type ShotMovement = 'static' | 'slow_zoom_in' | 'slow_zoom_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down';

export type ProjectRequirements = {
  format: ProjectFormat;
  audience: Audience;
  genre: string;
  tone: string;
  maxDuration?: string;
  constraints?: {
    mustInclude: string[];
    mustAvoid: string[];
    forbiddenPhrases: string[];
  };
};

export type MsgTextPart = {
  type: 'text'
  text: string
}

export type MsgToolCallPart = {
  type: 'tool-call'
  toolName: string
  toolCallId: string
  input: unknown
}

export type ToolResult = {
  type: 'text'
  value: string
} | {
  type: 'error-text'
  value: string
}

export type MsgToolResultPart = {
  type: 'tool-result'
  toolName: string
  toolCallId: string
  output: ToolResult
}

export type MsgContent = MsgTextPart | MsgToolCallPart | MsgToolResultPart

export type MsgContext = {
  blocks?: string[]
  selections?: string[]
}

export type MsgMetadata = {
  reasoningText?: string
  attachments?: Record<string, unknown>
  context?: MsgContext
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

export type AgentRunFinishReason = 'response' | 'error' | 'tool-calls' | 'aborted' | 'max-iterations' | 'not-finished';

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

export type DocumentId = 'synopsis' | 'script' | 'story_bible' | 'shots';

export type StoryBibleEntityType = 'character' | 'location' | 'prop';
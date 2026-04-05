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

export type TaskType = 'SCENE_GENERATION' | 'SHOT_GENERATION' | 'ENTITY_GENERATION' | 'IMAGE_GENERATION' | 'BATCH_GENERATION'
export type SseEventType = 'TASK_UPDATE' | 'CHAT_CHUNK'


export type ProjectPhase = 'DRAFT' | 'CONCEPT' | 'SYNOPSIS' | 'BUILDING' | 'EDITING';
export type ShotType = 'establishing' | 'wide' | 'medium' | 'closeup' | 'insert' | 'unspecified';
export type ShotAngle = 'eye_level' | 'low' | 'high' | 'over_shoulder' | 'top_down' | 'unspecified';
export type ShotMovement = 'static' | 'slow_zoom_in' | 'slow_zoom_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'unspecified';

export type ShotSubject = {
  characterId: string;
  costumeId?: string;
  equippedPropIds?: string[];
  actionAndPose: string;
}

export type SpeechTrack = {
  characterId: string;
  voiceModelId: string;
  speechType: 'narration' | 'dialogue' | 'thought' | 'internal_monologue';
  text: string;
  ttsParameters: {
    emotion: string;
    pacing: string;
  };
}

export type ShotVisuals = {
  subjects: ShotSubject[]
  environment: {
    locationId: string
    setting: string
    timeOfDay: string
    weatherOrAtmosphere: string
  },
  cameraPlan : {
    shotType: ShotType
    cameraAngle: ShotAngle
    lensAndDepth: string
    movement: ShotMovement
    focusSubject?: string
  },
  style: {
    lighting: string
    colorPalette: string[]
    medium: string
    pipelineModifiers: string
  }
}

export type ShotAudio = {
  speechTracks: SpeechTrack[];
  soundDesign: {
    ambientSfx: string
    actionSfx: string
  }
}
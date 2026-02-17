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
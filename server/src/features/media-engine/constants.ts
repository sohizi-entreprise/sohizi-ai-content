export const LUMEN_BASE_URL = 'https://api.lumenfall.ai/openai/v1';

export const VIDEO_POLL_INTERVAL_MS = 10_000;
export const MAX_VIDEO_POLL_ATTEMPTS = 60;
export const MAX_MEDIA_POLL_ATTEMPTS = MAX_VIDEO_POLL_ATTEMPTS;
export const VIDEO_POLL_INTERVAL = `${VIDEO_POLL_INTERVAL_MS / 1000}s` as const;

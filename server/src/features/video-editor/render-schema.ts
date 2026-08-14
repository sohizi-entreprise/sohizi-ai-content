import { z } from 'zod';

/**
 * Snapshot contract for `POST /video-editor/:projectId/compositions/:compositionId/renders`.
 *
 * The Cloudflare Worker re-validates every field strictly before a container ever
 * sees it (see `cloudflare/src/render/contracts.ts`). This layer therefore only
 * enforces what the API itself must know: the contract version, the render
 * limits we are willing to bill for, and enough clip shape to check media hosts.
 * Keep `RENDER_CONTRACT_VERSION` and `RENDER_LIMITS` in step with the Worker.
 */
export const RENDER_CONTRACT_VERSION = 1;

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
} as const;

const trackTypes = ['video', 'audio', 'text', 'image', 'html', 'caption'] as const;

const frame = z.number().int().min(0).max(RENDER_LIMITS.maxDurationInFrames);

const mediaUrl = z
  .string()
  .max(2048)
  .refine((value) => value.startsWith('https://'), {
    message: 'Media URLs must use https',
  });

/** Clips are forwarded verbatim; only render-relevant fields are asserted here. */
const clipSchema = z.looseObject({
  id: z.string().min(1).max(200),
  trackId: z.string().min(1).max(200),
  type: z.enum(trackTypes),
  startFrame: frame,
  endFrame: frame,
  sourceStartFrame: frame,
  sourceDurationInFrames: frame,
  url: mediaUrl.optional(),
});

const trackSchema = z.looseObject({
  id: z.string().min(1).max(200),
  type: z.enum(trackTypes),
  name: z.string().max(200),
  muted: z.boolean(),
  hidden: z.boolean(),
  clips: z.array(clipSchema).max(RENDER_LIMITS.maxClips),
});

export const renderCompositionSchema = z.object({
  fps: z.number().int().min(RENDER_LIMITS.minFps).max(RENDER_LIMITS.maxFps),
  width: z.number().int().min(RENDER_LIMITS.minDimension).max(RENDER_LIMITS.maxDimension),
  height: z.number().int().min(RENDER_LIMITS.minDimension).max(RENDER_LIMITS.maxDimension),
  durationInFrames: z
    .number()
    .int()
    .min(RENDER_LIMITS.minDurationInFrames)
    .max(RENDER_LIMITS.maxDurationInFrames),
  tracks: z.array(trackSchema).max(RENDER_LIMITS.maxTracks),
});

export const createRenderSchema = z.object({
  contractVersion: z.literal(RENDER_CONTRACT_VERSION),
  fileName: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[\w \-.]+$/, 'fileName may only contain letters, numbers, spaces, - _ .'),
  composition: renderCompositionSchema,
});

export type RenderComposition = z.infer<typeof renderCompositionSchema>;
export type RenderTrackInput = z.infer<typeof trackSchema>;
export type CreateRenderInput = z.infer<typeof createRenderSchema>;

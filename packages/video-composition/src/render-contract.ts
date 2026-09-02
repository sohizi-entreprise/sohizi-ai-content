import type { Track } from './types'

/**
 * Wire contract shared by the editor, the API and the render service.
 * Bump when the payload shape changes so the render service can reject
 * snapshots produced by an older client.
 */
export const RENDER_CONTRACT_VERSION = 1

/** Composition id registered in the renderer bundle. */
export const MAIN_COMPOSITION_ID = 'main'

/** Everything the renderer needs to reproduce what the editor previews. */
export type RenderCompositionInput = {
  fps: number
  width: number
  height: number
  durationInFrames: number
  tracks: Array<Track>
}

/**
 * Guard rails applied by the render service. They exist to keep a single
 * render inside the container's memory, disk and time budget.
 */
export const RENDER_LIMITS = {
  minFps: 1,
  maxFps: 120,
  minDimension: 16,
  maxDimension: 4096,
  minDurationInFrames: 1,
  /** 20 minutes at 60fps. */
  maxDurationInFrames: 72_000,
  maxTracks: 100,
  maxClips: 1_000,
  /** Serialized snapshot size, in bytes. */
  maxPayloadBytes: 8 * 1024 * 1024,
} as const

import { z } from "zod"

const aspectRatios = ["16:9", "9:16", "1:1", "4:5"] as const
const trackTypes = [
  "video",
  "audio",
  "text",
  "image",
  "html",
  "caption",
] as const

// ============================================================================
// COMPOSITIONS
// ============================================================================

export const createCompositionSchema = z.object({
  fileNodeId: z.uuid(),
  fps: z.number().int().min(1).max(120).default(30),
  durationInFrames: z.number().int().min(1).default(900),
  aspectRatio: z.enum(aspectRatios).default("16:9"),
  width: z.number().int().min(1).default(1920),
  height: z.number().int().min(1).default(1080),
})

export const updateCompositionSchema = z.object({
  fps: z.number().int().min(1).max(120).optional(),
  durationInFrames: z.number().int().min(1).optional(),
  aspectRatio: z.enum(aspectRatios).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
})

// ============================================================================
// TRACKS
// ============================================================================

export const addTrackSchema = z.object({
  id: z.uuid().optional(),
  type: z.enum(trackTypes),
  name: z.string().min(1).max(100),
  position: z.number().int().min(0).optional(),
  muted: z.boolean().default(false),
  hidden: z.boolean().default(false),
})

export const updateTrackSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().min(0).optional(),
  muted: z.boolean().optional(),
  hidden: z.boolean().optional(),
})

// ============================================================================
// CLIPS
// ============================================================================

const clipPropertiesSchema = z.record(z.string(), z.any())

export const addClipSchema = z.object({
  id: z.uuid().optional(),
  trackId: z.uuid(),
  type: z.enum(trackTypes),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  sourceStartFrame: z.number().int().min(0).default(0),
  sourceDurationInFrames: z.number().int().min(1),
  assetId: z.uuid().nullish(),
  properties: clipPropertiesSchema,
})

export const updateClipSchema = z.object({
  trackId: z.uuid().optional(),
  startFrame: z.number().int().min(0).optional(),
  endFrame: z.number().int().min(1).optional(),
  sourceStartFrame: z.number().int().min(0).optional(),
  sourceDurationInFrames: z.number().int().min(1).optional(),
  properties: clipPropertiesSchema.optional(),
})

export const clipFilterSchema = z.object({
  trackId: z.uuid().optional(),
  type: z.enum(trackTypes).optional(),
  fromFrame: z.coerce.number().int().min(0).optional(),
  toFrame: z.coerce.number().int().min(0).optional(),
})

// ============================================================================
// BATCH
// ============================================================================

const batchUpdateComposition = z.object({
  op: z.literal("update_composition"),
  compositionId: z.uuid(),
  patch: updateCompositionSchema,
})

const batchAddTrack = z.object({
  op: z.literal("add_track"),
  data: addTrackSchema,
})

const batchUpdateTrack = z.object({
  op: z.literal("update_track"),
  trackId: z.uuid(),
  patch: updateTrackSchema,
})

const batchRemoveTrack = z.object({
  op: z.literal("remove_track"),
  trackId: z.uuid(),
})

const batchAddClip = z.object({
  op: z.literal("add_clip"),
  data: addClipSchema,
})

const batchUpdateClip = z.object({
  op: z.literal("update_clip"),
  clipId: z.uuid(),
  patch: updateClipSchema,
})

const batchRemoveClip = z.object({
  op: z.literal("remove_clip"),
  clipId: z.uuid(),
})

export const batchOperationSchema = z.discriminatedUnion("op", [
  batchUpdateComposition,
  batchAddTrack,
  batchUpdateTrack,
  batchRemoveTrack,
  batchAddClip,
  batchUpdateClip,
  batchRemoveClip,
])

export const batchRequestSchema = z.object({
  operations: z.array(batchOperationSchema).min(1).max(50),
})

export type CreateCompositionInput = z.infer<typeof createCompositionSchema>
export type UpdateCompositionInput = z.infer<typeof updateCompositionSchema>
export type AddTrackInput = z.infer<typeof addTrackSchema>
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>
export type AddClipInput = z.infer<typeof addClipSchema>
export type UpdateClipInput = z.infer<typeof updateClipSchema>
export type ClipFilterInput = z.infer<typeof clipFilterSchema>
export type BatchOperation = z.infer<typeof batchOperationSchema>
export type BatchRequest = z.infer<typeof batchRequestSchema>

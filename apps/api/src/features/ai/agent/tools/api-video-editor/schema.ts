import { z } from "zod"

const filePath = z.string()
const clipId = z.uuid()
const trackId = z.uuid()
const trackTypeEnum = z.enum(["video", "audio", "text", "image"])

const overviewSchema = z
  .object({
    endpoint: z.literal("/video-editor/overview"),
    method: z.literal("GET"),
    params: z.object({
      filePath,
    }),
  })
  .describe(
    "Returns a lightweight summary of the entire composition: canvas settings, track list, and clip counts. Use this first to understand the timeline before drilling into specifics.",
  )

const listClipsSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/list"),
    method: z.literal("GET"),
    params: z.object({
      filePath,
      trackId: trackId.optional().describe("Filter to a specific track."),
      type: trackTypeEnum.optional().describe("Filter by clip type."),
      fromFrame: z
        .number()
        .int()
        .optional()
        .describe("Only return clips that overlap with this frame or later."),
      toFrame: z
        .number()
        .int()
        .optional()
        .describe("Only return clips that overlap with this frame or earlier."),
    }),
  })
  .describe(
    "List clips with optional filters. Returns: id, type, startFrame, endFrame, and a short label for each clip.",
  )

const viewClipSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/view"),
    method: z.literal("GET"),
    params: z.object({
      clipId,
    }),
  })
  .describe(
    "Returns the full details of a specific clip, including all properties.",
  )

const atFrameSchema = z
  .object({
    endpoint: z.literal("/video-editor/frame"),
    method: z.literal("GET"),
    params: z.object({
      filePath,
      frame: z.number().int().min(0).describe("The frame number to query."),
    }),
  })
  .describe(
    "Returns all clips that are visible/active at the given frame number. Useful for understanding what's on screen at a specific time.",
  )

const viewTrackSchema = z
  .object({
    endpoint: z.literal("/video-editor/tracks/view"),
    method: z.literal("GET"),
    params: z.object({
      trackId,
    }),
  })
  .describe("Returns a track's properties and a summary list of all its clips.")

const viewClipPropertiesSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/schema"),
    method: z.literal("GET"),
    params: z.object({
      clipType: trackTypeEnum,
    }),
  })
  .describe(
    "Returns the full schema of the properties of a specific clip type. Use this to understand the properties of a clip type before editing it.",
  )

const updateCompositionSchema = z
  .object({
    endpoint: z.literal("/video-editor/composition"),
    method: z.literal("PATCH"),
    body: z.object({
      filePath,
      fps: z.number().int().min(1).optional(),
      aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional(),
      durationInFrames: z.number().int().min(1).optional(),
      width: z.number().int().min(1).optional(),
      height: z.number().int().min(1).optional(),
    }),
  })
  .describe(
    "Update composition-level settings like fps, aspect ratio, or dimensions.",
  )

const addTrackSchema = z
  .object({
    endpoint: z.literal("/video-editor/tracks/add"),
    method: z.literal("POST"),
    body: z.object({
      filePath,
      type: trackTypeEnum,
      name: z.string().max(100),
      position: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Z-order position. 0 = bottom. Omit to add on top."),
    }),
  })
  .describe("Add a new track to the composition.")

const updateTrackSchema = z
  .object({
    endpoint: z.literal("/video-editor/tracks/update"),
    method: z.literal("PATCH"),
    body: z.object({
      trackId,
      name: z.string().max(100).optional(),
      position: z.number().int().min(0).optional(),
      muted: z.boolean().optional(),
      hidden: z.boolean().optional(),
    }),
  })
  .describe("Update a track's properties.")

const removeTrackSchema = z
  .object({
    endpoint: z.literal("/video-editor/tracks/remove"),
    method: z.literal("DELETE"),
    params: z.object({
      trackId,
    }),
  })
  .describe("Remove a track and all its clips.")

const addClipSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/add"),
    method: z.literal("POST"),
    body: z.object({
      trackId,
      type: trackTypeEnum,
      startFrame: z.number().int().min(0),
      endFrame: z.number().int().min(1),
      sourceStartFrame: z.number().int().min(0).default(0),
      sourceDurationInFrames: z.number().int().min(1),
      properties: z.record(z.string(), z.any()),
    }),
  })
  .describe("Add a new clip to a track.")

const updateClipSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/update"),
    method: z.literal("PATCH"),
    body: z.object({
      clipId,
      trackId: trackId.optional().describe("Move clip to a different track."),
      startFrame: z.number().int().min(0).optional(),
      endFrame: z.number().int().min(1).optional(),
      sourceStartFrame: z.number().int().min(0).optional(),
      sourceDurationInFrames: z.number().int().min(1).optional(),
      properties: z
        .record(z.string(), z.any())
        .optional()
        .describe("Partial property update. Existing fields are preserved."),
    }),
  })
  .describe(
    "Update a clip's timeline position or properties. Only include fields you want to change.",
  )

const removeClipSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/remove"),
    method: z.literal("DELETE"),
    params: z.object({
      clipId,
    }),
  })
  .describe("Remove a clip from the timeline.")

export const apiVideoEditorSchema = [
  overviewSchema,
  listClipsSchema,
  viewClipSchema,
  atFrameSchema,
  viewTrackSchema,
  viewClipPropertiesSchema,
  updateCompositionSchema,
  addTrackSchema,
  updateTrackSchema,
  removeTrackSchema,
  addClipSchema,
  updateClipSchema,
  removeClipSchema,
]

export type ApiVideoEditorRequest = z.infer<
  (typeof apiVideoEditorSchema)[number]
>

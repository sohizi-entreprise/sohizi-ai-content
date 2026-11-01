import { z } from "zod"

const filePath = z.string()
const clipId = z.uuid()
const trackId = z.uuid()
const trackTypeEnum = z.enum(["video", "audio", "text", "image", "caption"])
const aspectRatioEnum = z.enum(["16:9", "9:16", "1:1", "4:5"])

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
      aspectRatio: aspectRatioEnum.optional(),
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
        .describe(
          "Z-order position. 0 = top/foreground (closest to camera). Omit to append at the back.",
        ),
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

const splitClipSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/split"),
    method: z.literal("POST"),
    body: z.object({
      clipId,
      frame: z
        .number()
        .int()
        .min(1)
        .describe(
          "The timeline frame at which to split the clip (must be strictly between startFrame and endFrame).",
        ),
    }),
  })
  .describe(
    "Razor-split a clip at a specific timeline frame into two contiguous clips on the same track, automatically calculating sourceStartFrame continuity.",
  )

const rippleShiftSchema = z
  .object({
    endpoint: z.literal("/video-editor/clips/ripple-shift"),
    method: z.literal("POST"),
    body: z.object({
      filePath,
      fromFrame: z
        .number()
        .int()
        .min(0)
        .describe(
          "Shift all clips whose startFrame is at or after this frame.",
        ),
      deltaFrames: z
        .number()
        .int()
        .describe(
          "Frame offset to apply: positive shifts clips later (right), negative shifts clips earlier (left).",
        ),
      trackId: trackId
        .optional()
        .describe(
          "Optional trackId to restrict the ripple shift to a single track. Omit to shift across all tracks in harmony.",
        ),
    }),
  })
  .describe(
    "Ripple-shift all clips starting at or after fromFrame by deltaFrames across all tracks (or a single track) to preserve timeline synchronization.",
  )

const generateCaptionsSchema = z
  .object({
    endpoint: z.literal("/video-editor/captions/generate"),
    method: z.literal("POST"),
    body: z.object({
      trackId: trackId.describe(
        "The audio or video track ID to transcribe into word-by-word animated captions.",
      ),
      clipId: clipId
        .optional()
        .describe(
          "Optional specific audio or video clip ID on the track to transcribe. Omit to transcribe all clips on the track.",
        ),
    }),
  })
  .describe(
    "Transcribe an audio or video track (or a single clip) and automatically insert a synchronized caption track above it.",
  )

const batchOperationItemSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("update_composition"),
    patch: z.object({
      fps: z.number().int().min(1).optional(),
      aspectRatio: aspectRatioEnum.optional(),
      durationInFrames: z.number().int().min(1).optional(),
      width: z.number().int().min(1).optional(),
      height: z.number().int().min(1).optional(),
    }),
  }),
  z.object({
    op: z.literal("add_track"),
    data: z.object({
      type: trackTypeEnum,
      name: z.string().max(100),
      position: z.number().int().min(0).optional(),
      muted: z.boolean().optional(),
      hidden: z.boolean().optional(),
    }),
  }),
  z.object({
    op: z.literal("update_track"),
    trackId,
    patch: z.object({
      name: z.string().max(100).optional(),
      position: z.number().int().min(0).optional(),
      muted: z.boolean().optional(),
      hidden: z.boolean().optional(),
    }),
  }),
  z.object({
    op: z.literal("remove_track"),
    trackId,
  }),
  z.object({
    op: z.literal("add_clip"),
    data: z.object({
      trackId,
      type: trackTypeEnum,
      startFrame: z.number().int().min(0),
      endFrame: z.number().int().min(1),
      sourceStartFrame: z.number().int().min(0).default(0),
      sourceDurationInFrames: z.number().int().min(1),
      properties: z.record(z.string(), z.any()),
    }),
  }),
  z.object({
    op: z.literal("update_clip"),
    clipId,
    patch: z.object({
      trackId: trackId.optional(),
      startFrame: z.number().int().min(0).optional(),
      endFrame: z.number().int().min(1).optional(),
      sourceStartFrame: z.number().int().min(0).optional(),
      sourceDurationInFrames: z.number().int().min(1).optional(),
      properties: z.record(z.string(), z.any()).optional(),
    }),
  }),
  z.object({
    op: z.literal("remove_clip"),
    clipId,
  }),
])

const batchSchema = z
  .object({
    endpoint: z.literal("/video-editor/batch"),
    method: z.literal("POST"),
    body: z.object({
      filePath,
      operations: z
        .array(batchOperationItemSchema)
        .min(1)
        .max(50)
        .describe(
          "Ordered list of timeline operations (update_composition, add_track, update_track, remove_track, add_clip, update_clip, remove_clip) to execute in one call.",
        ),
    }),
  })
  .describe(
    "Execute multiple composition, track, and clip operations in a single call.",
  )

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
  splitClipSchema,
  rippleShiftSchema,
  generateCaptionsSchema,
  batchSchema,
]

export type ApiVideoEditorRequest = z.infer<
  (typeof apiVideoEditorSchema)[number]
>

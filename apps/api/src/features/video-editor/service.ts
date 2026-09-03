import * as repo from "./repo"
import type {
  AddClipInput,
  AddTrackInput,
  BatchOperation,
  ClipFilterInput,
  CreateCompositionInput,
  UpdateClipInput,
  UpdateCompositionInput,
  UpdateTrackInput,
} from "./schema"
import { BadRequest, InternalServerError, NotFound } from "../error"
import type {
  AudioMediaClipProperties,
  VideoClipProperties,
  VideoMediaClipProperties,
} from "@/type"
import type { VideoComposition, VideoTrack, VideoClip } from "@/db/schema"
import {
  createBillableMultiModalClient,
  type WordsWithText,
} from "../ai/agent/utils/multi-llm-client"
import { billingService, withBilling } from "../billing"
import { v4 as uuidv4 } from "uuid"
import { getProjectById } from "../project/repo"

// ============================================================================
// TYPES
// ============================================================================

type TrackWithClips = VideoTrack & { clips: VideoClip[] }

type FullCompositionState = {
  composition: VideoComposition
  tracks: TrackWithClips[]
}

// ============================================================================
// COMPOSITIONS
// ============================================================================

export const loadComposition = async (
  fileNodeId: string,
  projectId: string,
): Promise<FullCompositionState> => {
  const result = await repo.getFullCompositionByFileNodeId(fileNodeId)
  if (!result) {
    throw new NotFound("Composition not found for this file")
  }
  if (result.composition.projectId !== projectId) {
    throw new NotFound("Composition not found in this project")
  }

  const clipsByTrack = new Map<string, typeof result.clips>()
  for (const clip of result.clips) {
    const arr = clipsByTrack.get(clip.trackId)
    if (arr) arr.push(clip)
    else clipsByTrack.set(clip.trackId, [clip])
  }
  const tracks: TrackWithClips[] = result.tracks.map((t) => ({
    ...t,
    clips: clipsByTrack.get(t.id) ?? [],
  }))

  return { composition: result.composition, tracks }
}

export const createComposition = async (
  projectId: string,
  input: CreateCompositionInput,
) => {
  const existing = await repo.getCompositionByFileNodeId(input.fileNodeId)
  if (existing) {
    throw new BadRequest("A composition already exists for this file node")
  }

  return repo.createComposition({
    projectId,
    fileNodeId: input.fileNodeId,
    fps: input.fps,
    durationInFrames: input.durationInFrames,
    aspectRatio: input.aspectRatio,
    width: input.width,
    height: input.height,
  })
}

export const updateComposition = async (
  compositionId: string,
  projectId: string,
  input: UpdateCompositionInput,
) => {
  const composition = await repo.getCompositionById(compositionId)
  if (!composition || composition.projectId !== projectId) {
    throw new NotFound("Composition not found")
  }

  const updated = await repo.updateComposition(compositionId, input)
  if (!updated) {
    throw new NotFound("Composition not found")
  }
  return updated
}

// ============================================================================
// TRACKS
// ============================================================================

export const listTracks = async (compositionId: string, projectId: string) => {
  await assertCompositionAccess(compositionId, projectId)
  return repo.getTracksByCompositionId(compositionId)
}

export const addTrack = async (
  compositionId: string,
  projectId: string,
  input: AddTrackInput,
) => {
  await assertCompositionAccess(compositionId, projectId)

  const position =
    input.position ?? (await repo.getNextTrackPosition(compositionId))

  return repo.createTrack({
    compositionId,
    type: input.type,
    position,
    muted: input.muted,
    hidden: input.hidden,
  })
}

export const updateTrack = async (
  trackId: string,
  projectId: string,
  input: UpdateTrackInput,
) => {
  const track = await repo.getTrackById(trackId)
  if (!track) {
    throw new NotFound("Track not found")
  }
  await assertCompositionAccess(track.compositionId, projectId)

  const updated = await repo.updateTrack(trackId, input)
  if (!updated) {
    throw new NotFound("Track not found")
  }
  return updated
}

export const removeTrack = async (trackId: string, projectId: string) => {
  const track = await repo.getTrackById(trackId)
  if (!track) {
    throw new NotFound("Track not found")
  }
  await assertCompositionAccess(track.compositionId, projectId)

  const deleted = await repo.deleteTrack(trackId)
  if (!deleted) {
    throw new NotFound("Track not found")
  }
  return { ok: true }
}

// ============================================================================
// CLIPS
// ============================================================================

export const listClips = async (
  compositionId: string,
  projectId: string,
  filters: ClipFilterInput,
) => {
  await assertCompositionAccess(compositionId, projectId)
  return repo.getClipsByFilters(compositionId, filters)
}

export const addClip = async (
  compositionId: string,
  projectId: string,
  input: AddClipInput,
) => {
  await assertCompositionAccess(compositionId, projectId)

  const track = await repo.getTrackById(input.trackId)
  if (!track || track.compositionId !== compositionId) {
    throw new BadRequest("Track not found in this composition")
  }

  if (input.endFrame <= input.startFrame) {
    throw new BadRequest("endFrame must be greater than startFrame")
  }

  return repo.createClip({
    trackId: input.trackId,
    compositionId,
    type: input.type,
    startFrame: input.startFrame,
    endFrame: input.endFrame,
    sourceStartFrame: input.sourceStartFrame,
    sourceDurationInFrames: input.sourceDurationInFrames,
    assetId: input.assetId || null,
    properties: input.properties as VideoClipProperties,
  })
}

export const updateClip = async (
  clipId: string,
  projectId: string,
  input: UpdateClipInput,
) => {
  const clip = await repo.getClipById(clipId)
  if (!clip) {
    throw new NotFound("Clip not found")
  }
  await assertCompositionAccess(clip.compositionId, projectId)

  if (input.trackId) {
    const newTrack = await repo.getTrackById(input.trackId)
    if (!newTrack || newTrack.compositionId !== clip.compositionId) {
      throw new BadRequest("Target track not found in this composition")
    }
  }

  const updated = await repo.updateClip(clipId, input)
  if (!updated) {
    throw new NotFound("Clip not found")
  }
  return updated
}

export const removeClip = async (clipId: string, projectId: string) => {
  const clip = await repo.getClipById(clipId)
  if (!clip) {
    throw new NotFound("Clip not found")
  }
  await assertCompositionAccess(clip.compositionId, projectId)

  const deleted = await repo.deleteClip(clipId)
  if (!deleted) {
    throw new NotFound("Clip not found")
  }
  return { ok: true }
}

// ============================================================================
// BATCH
// ============================================================================

export const batchEdit = async (
  compositionId: string,
  projectId: string,
  operations: BatchOperation[],
) => {
  await assertCompositionAccess(compositionId, projectId)

  const batchOps: repo.BatchOperation[] = operations.map((op) => {
    switch (op.op) {
      case "update_composition":
        return {
          op: "update_composition",
          id: op.compositionId,
          data: op.patch,
        }
      case "add_track":
        return { op: "create_track", data: { ...op.data, compositionId } }
      case "update_track":
        return { op: "update_track", id: op.trackId, data: op.patch }
      case "remove_track":
        return { op: "delete_track", id: op.trackId }
      case "add_clip":
        return {
          op: "create_clip",
          data: {
            ...(op.data.id ? { id: op.data.id } : {}),
            compositionId,
            trackId: op.data.trackId,
            type: op.data.type,
            startFrame: op.data.startFrame,
            endFrame: op.data.endFrame,
            sourceStartFrame: op.data.sourceStartFrame,
            sourceDurationInFrames: op.data.sourceDurationInFrames,
            assetId: op.data.assetId || null,
            properties: op.data.properties as VideoClipProperties,
          },
        }
      case "update_clip":
        return { op: "update_clip", id: op.clipId, data: op.patch }
      case "remove_clip":
        return { op: "delete_clip", id: op.clipId }
    }
  })

  return repo.executeBatch(batchOps)
}

// Generate a caption
export const addCaption = async (
  trackId: string,
  projectId: string,
  userId: string,
) => {
  const track = await repo.getTrackById(trackId)
  if (!track) {
    throw new NotFound("Track not found")
  }
  if (!["audio", "video"].includes(track.type)) {
    throw new BadRequest(
      "Caption can only be generated for audio and video tracks",
    )
  }

  const project = await getProjectById(projectId)

  const composition = await repo.getCompositionById(track.compositionId)

  const payload: (Pick<
    VideoClip,
    "startFrame" | "endFrame" | "sourceStartFrame" | "sourceDurationInFrames"
  > & { url: string })[] = []

  const clips = await repo.getClipsByTrackId(trackId)

  for (const clip of clips) {
    if (clip.type === "audio" || clip.type === "video") {
      let url = (
        clip.properties as AudioMediaClipProperties | VideoMediaClipProperties
      ).url
      const offsetSeconds = clip.sourceStartFrame / composition.fps
      const clipDurationSeconds =
        (clip.endFrame - clip.startFrame) / composition.fps
      url = getOAudioUrl(url, clip.type, offsetSeconds, clipDurationSeconds)
      payload.push({
        url,
        startFrame: clip.startFrame,
        endFrame: clip.endFrame,
        sourceStartFrame: clip.sourceStartFrame,
        sourceDurationInFrames: clip.sourceDurationInFrames,
      })
    }
  }

  if (payload.length === 0) {
    throw new BadRequest("No clips found to generate caption for")
  }

  const audioClient = withBilling(
    createBillableMultiModalClient(),
    billingService,
  )

  const promises = payload.map((p) => {
    return (async () => {
      const transcription = await audioClient(
        {
          kind: "caption",
          url: p.url,
          estimatedDurationSeconds:
            (p.endFrame - p.startFrame) / composition.fps,
        },
        {
          organizationId: project.organizationId,
          userId,
          metadata: {
            runId: uuidv4(),
          },
        },
      )

      if (transcription.kind !== "caption") {
        throw new InternalServerError(
          "Unexpected multimodal output for caption",
        )
      }

      return {
        transcriptions: {
          text: transcription.text,
          words: transcription.words,
        } satisfies WordsWithText,
        startFrame: p.startFrame,
        endFrame: p.endFrame,
        sourceStartFrame: p.sourceStartFrame,
        sourceDurationInFrames: p.sourceDurationInFrames,
      }
    })()
  })

  const transcriptions = await Promise.all(promises)

  // Build a new track with the transcriptions and insert the clips
  // Update all the track position below the current track
  const tracksToUpdate = await repo.getTracksByCompositionId(
    track.compositionId,
    { min: track.position },
  )
  const newTrackId = uuidv4()
  await repo.executeBatch([
    {
      op: "create_track",
      data: {
        id: newTrackId,
        compositionId: track.compositionId,
        type: "caption",
        // name: 'Caption',
        position: track.position,
        muted: false,
        hidden: false,
      },
    },
    ...transcriptions.map((t) => {
      return {
        op: "create_clip" as const,
        data: {
          trackId: newTrackId,
          compositionId: track.compositionId,
          type: "caption" as const,
          startFrame: t.startFrame,
          endFrame: t.endFrame,
          sourceStartFrame: t.sourceStartFrame,
          sourceDurationInFrames: t.sourceDurationInFrames,
          properties: {
            text: t.transcriptions.text,
            words: t.transcriptions.words,
            fontSize: 48,
          },
        },
      }
    }),
    ...tracksToUpdate.map((t) => {
      return {
        op: "update_track" as const,
        id: t.id,
        data: { position: t.position + 1 },
      }
    }),
  ])

  return { ok: true }
}

// ============================================================================
// HELPERS
// ============================================================================

async function assertCompositionAccess(
  compositionId: string,
  projectId: string,
) {
  const composition = await repo.getCompositionById(compositionId)
  if (!composition || composition.projectId !== projectId) {
    throw new NotFound("Composition not found")
  }
  return composition
}

const MAX_CAPTION_AUDIO_SECONDS = 600

function getOAudioUrl(
  url: string,
  type: "audio" | "video",
  offsetSeconds = 0,
  maxDurationSeconds = 600,
) {
  const cdnUrl = import.meta.env.R2_PUBLIC_URL
  const workerUrl = import.meta.env.CLOUDFLARE_WORKER_URL
  if (!cdnUrl || !workerUrl) {
    console.error("R2_PUBLIC_URL or CLOUDFLARE_WORKER_URL is not set")
    throw new InternalServerError(
      "An error occurred while generating the audio url. You can report this issue.",
    )
  }

  const key = extractUrlKey(url)
  if (!key) {
    throw new BadRequest("Invalid media url")
  }

  const offset = Math.max(0, offsetSeconds)
  const duration = Math.max(
    0.1,
    Math.min(maxDurationSeconds, MAX_CAPTION_AUDIO_SECONDS),
  )

  let finalUrl = ""
  if (type === "audio") {
    const params = new URLSearchParams({
      key,
      offset: String(offset),
      duration: String(duration),
    })
    finalUrl = `${workerUrl.replace(/\/$/, "")}/?${params.toString()}`
  } else {
    const transformation = `mode=audio,time=${offset}s,duration=${duration}s`
    finalUrl = `${cdnUrl.replace(/\/$/, "")}/media/${transformation}/${key}`
  }

  try {
    return new URL(finalUrl).href
  } catch {
    throw new BadRequest("Something went wrong during url parsing")
  }
}

function extractUrlKey(url: string) {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.replace(/^[/]/, "")
  } catch {
    return null
  }
}

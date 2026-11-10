import type { VideoClip } from "@/db/schema"
import * as repo from "@/features/video-editor/repo"
import * as videoEditorService from "@/features/video-editor/service"
import {
  clipPropertiesSchemaByType,
  type VideoClipProperties,
  type VideoEditorChange,
} from "@/type"
import { toJSONSchema } from "zod"
import type { ToolExecutionOptions, ToolResult } from "../tool-definition"
import { failure, success } from "../utils"
import type { ApiVideoEditorRequest } from "./schema"

type RequestFor<Endpoint extends ApiVideoEditorRequest["endpoint"]> = Extract<
  ApiVideoEditorRequest,
  { endpoint: Endpoint }
>

async function resolveVideoFileNodeId(
  filePath: string,
  session: ToolExecutionOptions["session"],
): Promise<string | null> {
  const file = await session.resolveFileByPathOrId(filePath)
  return file?.id ?? null
}

export async function executeOverview(
  data: RequestFor<"/video-editor/overview">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const fileNodeId = await resolveVideoFileNodeId(data.params.filePath, session)
  if (!fileNodeId) return failure(`File ${data.params.filePath} not found`)

  const result = await repo.getFullCompositionByFileNodeId(fileNodeId)
  if (!result) {
    return failure("Video composition not found for this file.")
  }

  const { composition: comp, tracks, clips } = result
  const clipsByTrack = new Map<string, typeof clips>()
  for (const clip of clips) {
    const arr = clipsByTrack.get(clip.trackId)
    if (arr) arr.push(clip)
    else clipsByTrack.set(clip.trackId, [clip])
  }

  const fps = comp.fps
  const durationSec = (comp.durationInFrames / fps).toFixed(1)

  let output = `Composition: ${comp.width}x${comp.height} @ ${fps}fps, ${comp.aspectRatio}, duration: ${comp.durationInFrames} frames (${durationSec}s)\n`
  output += `Version: ${comp.version}\n\n`

  if (tracks.length === 0) {
    output += "Tracks: (none)\n"
  } else {
    output += `Tracks (${tracks.length}):\n`
    for (const track of tracks) {
      const trackClips = clipsByTrack.get(track.id) ?? []
      const span =
        trackClips.length > 0
          ? `${Math.min(...trackClips.map((c) => c.startFrame))}–${Math.max(...trackClips.map((c) => c.endFrame))}`
          : "empty"
      const mutedLabel = track.muted ? " (muted)" : ""
      const hiddenLabel = track.hidden ? " (hidden)" : ""
      output += `  ${track.position + 1}. [${track.type}] (trackId: ${track.id}, position: ${track.position}) — ${trackClips.length} clips, span: ${span}${mutedLabel}${hiddenLabel}\n`
    }
  }

  return success(output.trim())
}

export async function executeListClips(
  data: RequestFor<"/video-editor/clips/list">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const fileNodeId = await resolveVideoFileNodeId(data.params.filePath, session)
  if (!fileNodeId) return failure(`File ${data.params.filePath} not found`)

  const composition = await repo.getCompositionByFileNodeId(fileNodeId)
  if (!composition) {
    return failure("Video composition not found for this file.")
  }

  const clips = await repo.getClipsByFilters(composition.id, {
    trackId: data.params.trackId,
    type: data.params.type,
    fromFrame: data.params.fromFrame,
    toFrame: data.params.toFrame,
  })

  if (clips.length === 0) {
    return success("No clips found matching the filters.")
  }

  let output = `Clips (${clips.length}):\n`
  for (const clip of clips) {
    const label = getClipLabel(clip)
    output += `  - [${clip.type}] ${clip.id} — ${label} (${clip.startFrame}–${clip.endFrame})\n`
  }

  return success(output.trim())
}

export async function executeViewClip(
  data: RequestFor<"/video-editor/clips/view">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const clip = await repo.getClipById(data.params.clipId)
  if (!clip) {
    return failure("Clip not found.")
  }

  const output = JSON.stringify(
    {
      id: clip.id,
      trackId: clip.trackId,
      type: clip.type,
      startFrame: clip.startFrame,
      endFrame: clip.endFrame,
      sourceStartFrame: clip.sourceStartFrame,
      sourceDurationInFrames: clip.sourceDurationInFrames,
      properties: clip.properties,
    },
    null,
    2,
  )

  return success(output)
}

export async function executeAtFrame(
  data: RequestFor<"/video-editor/frame">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const fileNodeId = await resolveVideoFileNodeId(data.params.filePath, session)
  if (!fileNodeId) return failure(`File ${data.params.filePath} not found`)

  const comp = await repo.getCompositionByFileNodeId(fileNodeId)
  if (!comp) {
    return failure("Video composition not found for this file.")
  }

  const clips = await repo.getClipsAtFrame(comp.id, data.params.frame)
  const timeSec = (data.params.frame / comp.fps).toFixed(1)

  if (clips.length === 0) {
    return success(
      `No active clips at frame ${data.params.frame} (${timeSec}s).`,
    )
  }

  let output = `Active clips at frame ${data.params.frame} (${timeSec}s):\n`
  for (const clip of clips) {
    const label = getClipLabel(clip)
    output += `  - [${clip.type}] ${clip.id} — ${label} (${clip.startFrame}–${clip.endFrame})\n`
  }

  return success(output.trim())
}

export async function executeViewTrack(
  data: RequestFor<"/video-editor/tracks/view">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const track = await repo.getTrackById(data.params.trackId)
  if (!track) {
    return failure("Track not found.")
  }

  const clips = await repo.getClipsByTrackId(data.params.trackId)

  let output = `Track: [${track.type}]\n`
  output += `  Position: ${track.position}, Muted: ${track.muted}, Hidden: ${track.hidden}\n`
  output += `  Composition: ${track.compositionId}\n\n`

  if (clips.length === 0) {
    output += "Clips: (none)\n"
  } else {
    output += `Clips (${clips.length}):\n`
    for (const clip of clips) {
      const label = getClipLabel(clip)
      output += `  - ${clip.id} — ${label} (${clip.startFrame}–${clip.endFrame})\n`
    }
  }

  return success(output.trim())
}

export async function executeViewClipSchema(
  data: RequestFor<"/video-editor/clips/schema">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const zodSchema = clipPropertiesSchemaByType[data.params.clipType]
  if (!zodSchema) {
    return failure(
      "Unknown clip type. Valid types are: video, audio, text, image, caption.",
    )
  }
  const schema = toJSONSchema(zodSchema)
  return success(JSON.stringify(schema, null, 2))
}

export async function executeUpdateComposition(
  data: RequestFor<"/video-editor/composition">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const fileNodeId = await resolveVideoFileNodeId(data.body.filePath, session)
  if (!fileNodeId) return failure(`File ${data.body.filePath} not found`)

  const composition = await repo.getCompositionByFileNodeId(fileNodeId)
  if (!composition) {
    return failure("Video composition not found for this file.")
  }
  const { filePath: _filePath, ...patch } = data.body
  const updated = await repo.updateComposition(composition.id, patch)
  if (!updated) {
    return failure("Failed to update composition.")
  }
  return {
    ...success(`Composition updated. Version: ${updated.version}`),
    videoEditorChanges: [{ type: "update_composition", composition: updated }],
  }
}

export async function executeAddTrack(
  data: RequestFor<"/video-editor/tracks/add">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const fileNodeId = await resolveVideoFileNodeId(data.body.filePath, session)
  if (!fileNodeId) return failure(`File ${data.body.filePath} not found`)

  const composition = await repo.getCompositionByFileNodeId(fileNodeId)
  if (!composition) {
    return failure("Video composition not found for this file.")
  }

  let position: number
  const shiftedChanges: VideoEditorChange[] = []

  if (data.body.position !== undefined) {
    position = data.body.position
    const existingAtOrAfter =
      (await repo.getTracksByCompositionId?.(composition.id, {
        min: position,
      })) ?? []
    for (const existing of existingAtOrAfter) {
      const shifted = await repo.updateTrack(existing.id, {
        position: existing.position + 1,
      })
      if (shifted) {
        shiftedChanges.push({ type: "update_track", track: shifted })
      }
    }
  } else {
    position = await repo.getNextTrackPosition(composition.id)
  }

  const track = await repo.createTrack({
    compositionId: composition.id,
    type: data.body.type,
    position,
  })
  return {
    ...success(
      `Track created: ID: ${track.id} - Type: ${track.type} - Position: ${track.position}`,
    ),
    videoEditorChanges: [
      { type: "add_track", track, name: data.body.name },
      ...shiftedChanges,
    ],
  }
}

export async function executeUpdateTrack(
  data: RequestFor<"/video-editor/tracks/update">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const { trackId, name, ...patch } = data.body
  const shiftedChanges: VideoEditorChange[] = []

  if (patch.position !== undefined) {
    const existingTrack = await repo.getTrackById?.(trackId)
    if (existingTrack && existingTrack.position !== patch.position) {
      const oldPos = existingTrack.position
      const newPos = patch.position
      const allTracks =
        (await repo.getTracksByCompositionId?.(existingTrack.compositionId)) ??
        []
      for (const sibling of allTracks) {
        if (sibling.id === trackId) continue
        if (
          newPos < oldPos &&
          sibling.position >= newPos &&
          sibling.position < oldPos
        ) {
          const shifted = await repo.updateTrack(sibling.id, {
            position: sibling.position + 1,
          })
          if (shifted) {
            shiftedChanges.push({ type: "update_track", track: shifted })
          }
        } else if (
          newPos > oldPos &&
          sibling.position > oldPos &&
          sibling.position <= newPos
        ) {
          const shifted = await repo.updateTrack(sibling.id, {
            position: sibling.position - 1,
          })
          if (shifted) {
            shiftedChanges.push({ type: "update_track", track: shifted })
          }
        }
      }
    }
  }

  const updated = await repo.updateTrack(trackId, patch)
  if (!updated) {
    return failure("Track not found.")
  }
  return {
    ...success(`Track ${updated.id} updated.`),
    videoEditorChanges: [
      { type: "update_track", track: updated, name },
      ...shiftedChanges,
    ],
  }
}

export async function executeRemoveTrack(
  data: RequestFor<"/video-editor/tracks/remove">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const deleted = await repo.deleteTrack(data.params.trackId)
  if (!deleted) {
    return failure("Track not found.")
  }
  return {
    ...success(`Track ${data.params.trackId} removed (along with its clips).`),
    videoEditorChanges: [
      { type: "remove_track", trackId: data.params.trackId },
    ],
  }
}

export async function executeAddClip(
  data: RequestFor<"/video-editor/clips/add">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const track = await repo.getTrackById(data.body.trackId)
  if (!track) {
    return failure("Track not found.")
  }

  if (track.type !== data.body.type) {
    return failure(
      `Cannot add a "${data.body.type}" clip to a "${track.type}" track. Clip type must match track type.`,
    )
  }

  if (data.body.endFrame <= data.body.startFrame) {
    return failure("endFrame must be greater than startFrame.")
  }

  const clip = await repo.createClip({
    trackId: data.body.trackId,
    compositionId: track.compositionId,
    type: data.body.type,
    startFrame: data.body.startFrame,
    endFrame: data.body.endFrame,
    sourceStartFrame: data.body.sourceStartFrame,
    sourceDurationInFrames: data.body.sourceDurationInFrames,
    properties: data.body.properties as VideoClipProperties,
  })
  return {
    ...success(
      `Clip created: ${clip.id} [${clip.type}] at frames ${clip.startFrame}–${clip.endFrame}`,
    ),
    videoEditorChanges: [{ type: "add_clip", clip }],
  }
}

export async function executeUpdateClip(
  data: RequestFor<"/video-editor/clips/update">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const { clipId, ...patch } = data.body

  if (
    patch.trackId !== undefined ||
    patch.startFrame !== undefined ||
    patch.endFrame !== undefined
  ) {
    const existingClip = await repo.getClipById?.(clipId)
    if (existingClip) {
      const nextStart = patch.startFrame ?? existingClip.startFrame
      const nextEnd = patch.endFrame ?? existingClip.endFrame
      if (nextEnd <= nextStart) {
        return failure("endFrame must be greater than startFrame.")
      }
      if (
        patch.trackId !== undefined &&
        patch.trackId !== existingClip.trackId
      ) {
        const targetTrack = await repo.getTrackById(patch.trackId)
        if (!targetTrack) {
          return failure("Target track not found.")
        }
        if (targetTrack.type !== existingClip.type) {
          return failure(
            `Cannot move a "${existingClip.type}" clip to a "${targetTrack.type}" track. Clip type must match track type.`,
          )
        }
      }
    }
  }

  const updated = await repo.updateClip(clipId, patch)
  if (!updated) {
    return failure("Clip not found.")
  }
  return {
    ...success(`Clip ${updated.id} updated.`),
    videoEditorChanges: [{ type: "update_clip", clip: updated }],
  }
}

export async function executeRemoveClip(
  data: RequestFor<"/video-editor/clips/remove">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const deleted = await repo.deleteClip(data.params.clipId)
  if (!deleted) {
    return failure("Clip not found.")
  }
  return {
    ...success(`Clip ${data.params.clipId} removed.`),
    videoEditorChanges: [{ type: "remove_clip", clipId: data.params.clipId }],
  }
}

export async function executeSplitClip(
  data: RequestFor<"/video-editor/clips/split">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const { clipId, frame } = data.body
  const clip = await repo.getClipById(clipId)
  if (!clip) {
    return failure("Clip not found.")
  }

  if (frame <= clip.startFrame || frame >= clip.endFrame) {
    return failure(
      `Split frame (${frame}) must be strictly between clip startFrame (${clip.startFrame}) and endFrame (${clip.endFrame}).`,
    )
  }

  const leftDurationFrames = frame - clip.startFrame
  const props = (clip.properties ?? {}) as Record<string, unknown>
  const speed =
    typeof props.speed === "number" &&
    Number.isFinite(props.speed) &&
    props.speed > 0
      ? props.speed
      : 1

  const rightSourceStartFrame =
    clip.type === "video" || clip.type === "audio"
      ? clip.sourceStartFrame + Math.round(leftDurationFrames * speed)
      : clip.sourceStartFrame

  const leftProperties: Record<string, unknown> = { ...props }
  const rightProperties: Record<string, unknown> = { ...props }
  if ("fadeOutFrames" in leftProperties) {
    leftProperties.fadeOutFrames = 0
  }
  if ("fadeInFrames" in rightProperties) {
    rightProperties.fadeInFrames = 0
  }

  if (clip.type === "caption" && Array.isArray(props.words)) {
    const composition = await repo.getCompositionById?.(clip.compositionId)
    const fps = composition?.fps && composition.fps > 0 ? composition.fps : 30
    const splitTimeSec = leftDurationFrames / fps
    const words = props.words as Array<{
      word: string
      start: number
      end: number
    }>
    const leftWords = words
      .filter((w) => (w.start + w.end) / 2 < splitTimeSec)
      .map((w) => ({
        word: w.word,
        start: w.start,
        end: Number(Math.min(w.end, splitTimeSec).toFixed(3)),
      }))
    const rightWords = words
      .filter((w) => (w.start + w.end) / 2 >= splitTimeSec)
      .map((w) => ({
        word: w.word,
        start: Number(Math.max(0, w.start - splitTimeSec).toFixed(3)),
        end: Number(Math.max(0, w.end - splitTimeSec).toFixed(3)),
      }))
    leftProperties.words = leftWords
    leftProperties.text = leftWords.map((w) => w.word.trim()).join(" ")
    rightProperties.words = rightWords
    rightProperties.text = rightWords.map((w) => w.word.trim()).join(" ")
  }

  const updatedLeft = await repo.updateClip(clipId, {
    endFrame: frame,
    properties: leftProperties,
  })
  if (!updatedLeft) {
    return failure("Failed to update left half of split clip.")
  }

  const createdRight = await repo.createClip({
    trackId: clip.trackId,
    compositionId: clip.compositionId,
    type: clip.type,
    startFrame: frame,
    endFrame: clip.endFrame,
    sourceStartFrame: rightSourceStartFrame,
    sourceDurationInFrames: clip.sourceDurationInFrames,
    properties: rightProperties as VideoClipProperties,
  })

  return {
    ...success(
      `Split clip ${clip.id} at frame ${frame}: left clip ${updatedLeft.id} (${updatedLeft.startFrame}–${updatedLeft.endFrame}), right clip ${createdRight.id} (${createdRight.startFrame}–${createdRight.endFrame}, sourceStartFrame: ${createdRight.sourceStartFrame}).`,
    ),
    videoEditorChanges: [
      { type: "update_clip", clip: updatedLeft },
      { type: "add_clip", clip: createdRight },
    ],
  }
}

export async function executeRippleShift(
  data: RequestFor<"/video-editor/clips/ripple-shift">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { filePath, fromFrame, deltaFrames, trackId } = data.body
  const fileNodeId = await resolveVideoFileNodeId(filePath, session)
  if (!fileNodeId) return failure(`File ${filePath} not found`)

  const composition = await repo.getCompositionByFileNodeId(fileNodeId)
  if (!composition) {
    return failure("Video composition not found for this file.")
  }

  if (deltaFrames === 0) {
    return success("No shift applied (deltaFrames is 0).")
  }

  const allClips = await repo.getClipsByFilters(composition.id, {
    trackId,
  })

  const shiftingClips = allClips.filter((c) => c.startFrame >= fromFrame)
  if (shiftingClips.length === 0) {
    return success(`No clips found starting at or after frame ${fromFrame}.`)
  }

  const stationaryClips = allClips.filter((c) => c.startFrame < fromFrame)

  // Validate that shifting left does not push any clip before frame 0 or into a stationary clip on the same track
  if (deltaFrames < 0) {
    const maxStationaryEndByTrack = new Map<string, number>()
    for (const c of stationaryClips) {
      const prevMax = maxStationaryEndByTrack.get(c.trackId) ?? 0
      if (c.endFrame > prevMax) {
        maxStationaryEndByTrack.set(c.trackId, c.endFrame)
      }
    }

    for (const c of shiftingClips) {
      const nextStart = c.startFrame + deltaFrames
      if (nextStart < 0) {
        return failure(
          `Cannot shift clip ${c.id} by ${deltaFrames} frames: new startFrame (${nextStart}) would be negative.`,
        )
      }
      const stationaryEnd = maxStationaryEndByTrack.get(c.trackId)
      if (stationaryEnd !== undefined && nextStart < stationaryEnd) {
        return failure(
          `Cannot shift clip ${c.id} to frame ${nextStart}: it would overlap an earlier clip ending at frame ${stationaryEnd} on track ${c.trackId}.`,
        )
      }
    }
  }

  // Order updates so intermediate states never collide: right-to-left when expanding (+delta), left-to-right when contracting (-delta)
  const ordered = [...shiftingClips].sort((a, b) =>
    deltaFrames > 0 ? b.startFrame - a.startFrame : a.startFrame - b.startFrame,
  )

  const changes: VideoEditorChange[] = []
  for (const clip of ordered) {
    const updated = await repo.updateClip(clip.id, {
      startFrame: clip.startFrame + deltaFrames,
      endFrame: clip.endFrame + deltaFrames,
    })
    if (updated) {
      changes.push({ type: "update_clip", clip: updated })
    }
  }

  return {
    ...success(
      `Ripple-shifted ${changes.length} clip(s) starting from frame ${fromFrame} by ${deltaFrames > 0 ? `+${deltaFrames}` : deltaFrames} frames.`,
    ),
    videoEditorChanges: changes,
  }
}

export async function executeGenerateCaptions(
  data: RequestFor<"/video-editor/captions/generate">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { trackId, clipId } = data.body
  const track = await repo.getTrackById(trackId)
  if (!track) {
    return failure("Track not found.")
  }

  const before = await repo.getFullComposition(track.compositionId)
  const beforeTrackIds = new Set(before.tracks.map((t) => t.id))
  const beforeTrackPositions = new Map(
    before.tracks.map((t) => [t.id, t.position]),
  )

  try {
    await videoEditorService.addCaption(
      trackId,
      session.projectId,
      session.userId,
      clipId,
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate captions."
    return failure(message)
  }

  const after = await repo.getFullComposition(track.compositionId)
  const changes: VideoEditorChange[] = []

  for (const t of after.tracks) {
    if (!beforeTrackIds.has(t.id)) {
      changes.push({ type: "add_track", track: t, name: "Captions" })
      const newClips = after.clips.filter((c) => c.trackId === t.id)
      for (const c of newClips) {
        changes.push({ type: "add_clip", clip: c })
      }
    } else if (beforeTrackPositions.get(t.id) !== t.position) {
      changes.push({ type: "update_track", track: t })
    }
  }

  const addedClipCount = changes.filter((c) => c.type === "add_clip").length
  return {
    ...success(
      `Generated caption track with ${addedClipCount} caption clip(s) from track ${trackId}.`,
    ),
    videoEditorChanges: changes,
  }
}

export async function executeBatch(
  data: RequestFor<"/video-editor/batch">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { filePath, operations } = data.body
  const fileNodeId = await resolveVideoFileNodeId(filePath, session)
  if (!fileNodeId) return failure(`File ${filePath} not found`)

  const composition = await repo.getCompositionByFileNodeId(fileNodeId)
  if (!composition) {
    return failure("Video composition not found for this file.")
  }

  const changes: VideoEditorChange[] = []
  const knownTracks = new Map<
    string,
    { id: string; type: string; position: number; compositionId: string }
  >()
  const initialTracks =
    (await repo.getTracksByCompositionId?.(composition.id)) ?? []
  for (const t of initialTracks) {
    knownTracks.set(t.id, t)
  }

  for (const op of operations) {
    switch (op.op) {
      case "update_composition": {
        const updated = await repo.updateComposition(composition.id, op.patch)
        if (!updated) return failure("Failed to update composition in batch.")
        changes.push({ type: "update_composition", composition: updated })
        break
      }
      case "add_track": {
        let position: number
        const shiftedChanges: VideoEditorChange[] = []
        if (op.data.position !== undefined) {
          position = op.data.position
          const existingAtOrAfter =
            (await repo.getTracksByCompositionId?.(composition.id, {
              min: position,
            })) ?? []
          for (const existing of existingAtOrAfter) {
            const shifted = await repo.updateTrack(existing.id, {
              position: existing.position + 1,
            })
            if (shifted) {
              knownTracks.set(shifted.id, shifted)
              shiftedChanges.push({ type: "update_track", track: shifted })
            }
          }
        } else {
          position = await repo.getNextTrackPosition(composition.id)
        }
        const track = await repo.createTrack({
          compositionId: composition.id,
          type: op.data.type,
          position,
          muted: op.data.muted,
          hidden: op.data.hidden,
        })
        knownTracks.set(track.id, track)
        changes.push({ type: "add_track", track, name: op.data.name })
        changes.push(...shiftedChanges)
        break
      }
      case "update_track": {
        const { name, ...trackPatch } = op.patch
        const shiftedChanges: VideoEditorChange[] = []
        if (trackPatch.position !== undefined) {
          const existingTrack =
            knownTracks.get(op.trackId) ??
            (await repo.getTrackById?.(op.trackId))
          if (existingTrack && existingTrack.position !== trackPatch.position) {
            const oldPos = existingTrack.position
            const newPos = trackPatch.position
            const allTracks =
              (await repo.getTracksByCompositionId?.(composition.id)) ?? []
            for (const sibling of allTracks) {
              if (sibling.id === op.trackId) continue
              if (
                newPos < oldPos &&
                sibling.position >= newPos &&
                sibling.position < oldPos
              ) {
                const shifted = await repo.updateTrack(sibling.id, {
                  position: sibling.position + 1,
                })
                if (shifted) {
                  knownTracks.set(shifted.id, shifted)
                  shiftedChanges.push({ type: "update_track", track: shifted })
                }
              } else if (
                newPos > oldPos &&
                sibling.position > oldPos &&
                sibling.position <= newPos
              ) {
                const shifted = await repo.updateTrack(sibling.id, {
                  position: sibling.position - 1,
                })
                if (shifted) {
                  knownTracks.set(shifted.id, shifted)
                  shiftedChanges.push({ type: "update_track", track: shifted })
                }
              }
            }
          }
        }
        const updated = await repo.updateTrack(op.trackId, trackPatch)
        if (!updated) return failure(`Track ${op.trackId} not found in batch.`)
        knownTracks.set(updated.id, updated)
        changes.push({ type: "update_track", track: updated, name })
        changes.push(...shiftedChanges)
        break
      }
      case "remove_track": {
        const deleted = await repo.deleteTrack(op.trackId)
        if (!deleted) return failure(`Track ${op.trackId} not found in batch.`)
        knownTracks.delete(op.trackId)
        changes.push({ type: "remove_track", trackId: op.trackId })
        break
      }
      case "add_clip": {
        if (op.data.endFrame <= op.data.startFrame) {
          return failure(
            "endFrame must be greater than startFrame in batch add_clip.",
          )
        }
        const targetTrack =
          knownTracks.get(op.data.trackId) ??
          (await repo.getTrackById?.(op.data.trackId))
        if (targetTrack && targetTrack.type !== op.data.type) {
          return failure(
            `Cannot add a "${op.data.type}" clip to a "${targetTrack.type}" track in batch. Clip type must match track type.`,
          )
        }
        const clip = await repo.createClip({
          trackId: op.data.trackId,
          compositionId: composition.id,
          type: op.data.type,
          startFrame: op.data.startFrame,
          endFrame: op.data.endFrame,
          sourceStartFrame: op.data.sourceStartFrame,
          sourceDurationInFrames: op.data.sourceDurationInFrames,
          properties: op.data.properties as VideoClipProperties,
        })
        changes.push({ type: "add_clip", clip })
        break
      }
      case "update_clip": {
        if (
          op.patch.trackId !== undefined ||
          op.patch.startFrame !== undefined ||
          op.patch.endFrame !== undefined
        ) {
          const existingClip = await repo.getClipById?.(op.clipId)
          if (existingClip) {
            const nextStart = op.patch.startFrame ?? existingClip.startFrame
            const nextEnd = op.patch.endFrame ?? existingClip.endFrame
            if (nextEnd <= nextStart) {
              return failure(
                "endFrame must be greater than startFrame in batch update_clip.",
              )
            }
            if (
              op.patch.trackId !== undefined &&
              op.patch.trackId !== existingClip.trackId
            ) {
              const targetTrack =
                knownTracks.get(op.patch.trackId) ??
                (await repo.getTrackById?.(op.patch.trackId))
              if (targetTrack && targetTrack.type !== existingClip.type) {
                return failure(
                  `Cannot move a "${existingClip.type}" clip to a "${targetTrack.type}" track in batch. Clip type must match track type.`,
                )
              }
            }
          }
        }
        const updated = await repo.updateClip(op.clipId, op.patch)
        if (!updated) return failure(`Clip ${op.clipId} not found in batch.`)
        changes.push({ type: "update_clip", clip: updated })
        break
      }
      case "remove_clip": {
        const deleted = await repo.deleteClip(op.clipId)
        if (!deleted) return failure(`Clip ${op.clipId} not found in batch.`)
        changes.push({ type: "remove_clip", clipId: op.clipId })
        break
      }
    }
  }

  return {
    ...success(`Executed ${changes.length} batch operation(s) successfully.`),
    videoEditorChanges: changes,
  }
}

function getClipLabel(clip: VideoClip): string {
  const props = clip.properties as Record<string, unknown>
  if (clip.type === "text" || clip.type === "caption") {
    const text = String(props.text ?? "")
    return `"${text.length > 30 ? text.slice(0, 30) + "…" : text}"`
  }
  return String(props.fileName ?? "unknown")
}

import type { VideoClip } from "@/db/schema"
import * as repo from "@/features/video-editor/repo"
import { clipPropertiesSchemaByType, type VideoClipProperties } from "@/type"
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
      output += `  ${track.position + 1}. [${track.type}] (trackId: ${track.id}) — ${trackClips.length} clips, span: ${span}${mutedLabel}${hiddenLabel}\n`
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
      "Unknown clip type. Valid types are: video, audio, text, image.",
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
  const position =
    data.body.position ?? (await repo.getNextTrackPosition(composition.id))
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
    ],
  }
}

export async function executeUpdateTrack(
  data: RequestFor<"/video-editor/tracks/update">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const { trackId, ...patch } = data.body
  const updated = await repo.updateTrack(trackId, patch)
  if (!updated) {
    return failure("Track not found.")
  }
  return {
    ...success(`Track ${updated.id} updated.`),
    videoEditorChanges: [
      { type: "update_track", track: updated, name: data.body.name },
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

function getClipLabel(clip: VideoClip): string {
  const props = clip.properties as Record<string, unknown>
  if (clip.type === "text") {
    const text = String(props.text ?? "")
    return `"${text.length > 30 ? text.slice(0, 30) + "…" : text}"`
  }
  return String(props.fileName ?? "unknown")
}

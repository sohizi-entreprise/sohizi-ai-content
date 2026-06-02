import { z, toJSONSchema } from "zod";
import { buildBaseTool } from "./tool-definition";
import { success, failure } from "./utils";
import * as repo from "@/features/video-editor/repo";
import type { VideoClip } from "@/db/schema";
import { clipPropertiesSchemaByType } from "@/type";

const fileNodeId = z.uuid().describe("The file node ID of the video file.");
const clipId = z.uuid().describe("The clip ID.");
const trackId = z.uuid().describe("The track ID.");

const overviewCommand = z.object({
  cmd: z.literal('overview').describe(
    "Returns a lightweight summary of the entire composition: canvas settings, track list, and clip counts. Use this first to understand the timeline before drilling into specifics."
  ),
  fileNodeId,
});

const listClipsCommand = z.object({
  cmd: z.literal('list_clips').describe(
    "List clips with optional filters. Returns: id, type, startFrame, endFrame, and a short label for each clip."
  ),
  fileNodeId,
  trackId: trackId.optional().describe("Filter to a specific track."),
  type: z.enum(['video', 'audio', 'text', 'image', 'html']).optional().describe("Filter by clip type."),
  fromFrame: z.number().int().optional().describe("Only return clips that overlap with this frame or later."),
  toFrame: z.number().int().optional().describe("Only return clips that overlap with this frame or earlier."),
});

const viewClipCommand = z.object({
  cmd: z.literal('view_clip').describe(
    "Returns the full details of a specific clip, including all properties."
  ),
  clipId,
});

const atFrameCommand = z.object({
  cmd: z.literal('at_frame').describe(
    "Returns all clips that are visible/active at the given frame number. Useful for understanding what's on screen at a specific time."
  ),
  fileNodeId,
  frame: z.number().int().min(0).describe("The frame number to query."),
});

const viewTrackCommand = z.object({
  cmd: z.literal('view_track').describe(
    "Returns a track's properties and a summary list of all its clips."
  ),
  trackId,
});

const viewClipPropertiesSchema = z.object({
  cmd: z.literal('view_clip_schema').describe(
    "Returns the full schema of the properties of a specific clip type. Use this to understand the properties of a clip type before editing it."
  ),
  clipType: z.enum(['video', 'audio', 'text', 'image', 'html']),
});

const toolSchema = z.discriminatedUnion('cmd', [
  overviewCommand,
  listClipsCommand,
  viewClipCommand,
  atFrameCommand,
  viewTrackCommand,
  viewClipPropertiesSchema,
]);


export const timelineExploreTool = buildBaseTool({
  name: "timelineExplore",
  description: "Explore a video timeline. Use 'overview' first to understand the structure, then drill into specific tracks or clips. Use 'at_frame' to see what's visible at a given time.",
  inputSchema: z.object({ command: toolSchema }),
  execute: async (cmd, { session }) => {
    const input = cmd.command;
    switch (input.cmd) {
      case 'overview':
        return executeOverview(input.fileNodeId);
      case 'list_clips':
        return executeListClips(input);
      case 'view_clip':
        return executeViewClip(input.clipId);
      case 'at_frame':
        return executeAtFrame(input.fileNodeId, input.frame);
      case 'view_track':
        return executeViewTrack(input.trackId);
      case 'view_clip_schema':
        return executeViewClipSchema(input.clipType);
      default:
        return failure('Unknown command. Valid commands are: overview, list_clips, view_clip, at_frame, view_track, view_clip_schema.');
    }
  },
});

async function executeOverview(fileNodeId: string) {
  const result = await repo.getFullCompositionByFileNodeId(fileNodeId);
  if (!result) {
    return failure('Video composition not found for this file.');
  }

  const { composition: comp, tracks, clips } = result;
  const clipsByTrack = new Map<string, typeof clips>();
  for (const clip of clips) {
    const arr = clipsByTrack.get(clip.trackId);
    if (arr) arr.push(clip);
    else clipsByTrack.set(clip.trackId, [clip]);
  }

  const fps = comp.fps;
  const durationSec = (comp.durationInFrames / fps).toFixed(1);

  let output = `Composition: ${comp.width}x${comp.height} @ ${fps}fps, ${comp.aspectRatio}, duration: ${comp.durationInFrames} frames (${durationSec}s)\n`;
  output += `Version: ${comp.version}\n\n`;

  if (tracks.length === 0) {
    output += 'Tracks: (none)\n';
  } else {
    output += `Tracks (${tracks.length}):\n`;
    for (const track of tracks) {
      const trackClips = clipsByTrack.get(track.id) ?? [];
      const span = trackClips.length > 0
        ? `${Math.min(...trackClips.map((c) => c.startFrame))}–${Math.max(...trackClips.map((c) => c.endFrame))}`
        : 'empty';
      const mutedLabel = track.muted ? ' (muted)' : '';
      const hiddenLabel = track.hidden ? ' (hidden)' : '';
      output += `  ${track.position + 1}. [${track.type}] — ${trackClips.length} clips, span: ${span}${mutedLabel}${hiddenLabel}\n`;
    }
  }

  return success(output.trim());
}

async function executeListClips(input: z.infer<typeof listClipsCommand>) {
  const composition = await repo.getCompositionByFileNodeId(input.fileNodeId);
  if (!composition) {
    return failure('Video composition not found for this file.');
  }

  const clips = await repo.getClipsByFilters(composition.id, {
    trackId: input.trackId,
    type: input.type,
    fromFrame: input.fromFrame,
    toFrame: input.toFrame,
  });

  if (clips.length === 0) {
    return success('No clips found matching the filters.');
  }

  let output = `Clips (${clips.length}):\n`;
  for (const clip of clips) {
    const label = getClipLabel(clip);
    output += `  - [${clip.type}] ${clip.id} — ${label} (${clip.startFrame}–${clip.endFrame})\n`;
  }

  return success(output.trim());
}

async function executeViewClip(clipId: string) {
  const clip = await repo.getClipById(clipId);
  if (!clip) {
    return failure('Clip not found.');
  }

  const output = JSON.stringify({
    id: clip.id,
    trackId: clip.trackId,
    type: clip.type,
    startFrame: clip.startFrame,
    endFrame: clip.endFrame,
    sourceStartFrame: clip.sourceStartFrame,
    sourceDurationInFrames: clip.sourceDurationInFrames,
    assetId: clip.assetId,
    properties: clip.properties,
  }, null, 2);

  return success(output);
}

async function executeAtFrame(fileNodeId: string, frame: number) {
  const comp = await repo.getCompositionByFileNodeId(fileNodeId);
  if (!comp) {
    return failure('Video composition not found for this file.');
  }

  const clips = await repo.getClipsAtFrame(comp.id, frame);
  const timeSec = (frame / comp.fps).toFixed(1);

  if (clips.length === 0) {
    return success(`No active clips at frame ${frame} (${timeSec}s).`);
  }

  let output = `Active clips at frame ${frame} (${timeSec}s):\n`;
  for (const clip of clips) {
    const label = getClipLabel(clip);
    output += `  - [${clip.type}] ${clip.id} — ${label} (${clip.startFrame}–${clip.endFrame})\n`;
  }

  return success(output.trim());
}

async function executeViewTrack(trackId: string) {
  const track = await repo.getTrackById(trackId);
  if (!track) {
    return failure('Track not found.');
  }

  const clips = await repo.getClipsByTrackId(trackId);

  let output = `Track: [${track.type}]\n`;
  output += `  Position: ${track.position}, Muted: ${track.muted}, Hidden: ${track.hidden}\n`;
  output += `  Composition: ${track.compositionId}\n\n`;

  if (clips.length === 0) {
    output += 'Clips: (none)\n';
  } else {
    output += `Clips (${clips.length}):\n`;
    for (const clip of clips) {
      const label = getClipLabel(clip);
      output += `  - ${clip.id} — ${label} (${clip.startFrame}–${clip.endFrame})\n`;
    }
  }

  return success(output.trim());
}

function executeViewClipSchema(clipType: 'video' | 'audio' | 'text' | 'image' | 'html') {
  const zodSchema = clipPropertiesSchemaByType[clipType];
  if (!zodSchema) {
    return failure('Unknown clip type. Valid types are: video, audio, text, image, html.');
  }
  const schema = toJSONSchema(zodSchema);
  return success(JSON.stringify(schema, null, 2));
}

function getClipLabel(clip: VideoClip): string {
  const props = clip.properties as Record<string, unknown>;
  if (clip.type === 'text') {
    const text = String(props.text ?? '');
    return `"${text.length > 30 ? text.slice(0, 30) + '…' : text}"`;
  }
  return String(props.fileName ?? clip.assetId ?? 'unknown');
}

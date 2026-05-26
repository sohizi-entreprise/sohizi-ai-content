import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { success, failure } from "./utils";
import * as repo from "@/features/video-editor/repo";
import type { VideoClipProperties } from "@/type";

const compositionId = z.uuid().describe("The video composition ID.");

const updateCompositionCommand = z.object({
  cmd: z.literal('update_composition').describe("Update composition-level settings like fps, aspect ratio, or dimensions."),
  compositionId,
  patch: z.object({
    fps: z.number().int().min(1).optional(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
    durationInFrames: z.number().int().min(1).optional(),
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
  }).describe("Only include fields you want to change."),
});

const addTrackCommand = z.object({
  cmd: z.literal('add_track').describe("Add a new track to the composition."),
  compositionId,
  type: z.enum(['video', 'audio', 'text', 'image']),
  name: z.string().max(100),
  position: z.number().int().min(0).optional().describe("Z-order position. 0 = bottom. Omit to add on top."),
});

const updateTrackCommand = z.object({
  cmd: z.literal('update_track').describe("Update a track's properties."),
  trackId: z.uuid(),
  patch: z.object({
    name: z.string().max(100).optional(),
    position: z.number().int().min(0).optional(),
    muted: z.boolean().optional(),
    hidden: z.boolean().optional(),
  }),
});

const removeTrackCommand = z.object({
  cmd: z.literal('remove_track').describe("Remove a track and all its clips."),
  trackId: z.uuid(),
});

const addClipCommand = z.object({
  cmd: z.literal('add_clip').describe("Add a new clip to a track."),
  trackId: z.uuid(),
  type: z.enum(['video', 'audio', 'text', 'image']),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  sourceStartFrame: z.number().int().min(0).default(0),
  sourceDurationInFrames: z.number().int().min(1),
  assetId: z.string().uuid().optional().describe("Reference to an asset. Required for video/audio/image clips."),
  properties: z.record(z.string(), z.any()).describe(
    "Type-specific properties. For text: {text, fontSize, color, fontFamily, fontWeight, align, opacity, xRatio, yRatio, widthRatio, heightRatio}. For video: {url, fileName, volume, opacity, speed, borderRadius}. For audio: {url, fileName, volume, speed}. For image: {url, fileName, opacity, borderRadius, blur, brightness, xRatio, yRatio, widthRatio, heightRatio}."
  ),
});

const updateClipCommand = z.object({
  cmd: z.literal('update_clip').describe("Update a clip's timeline position or properties. Only include fields you want to change."),
  clipId: z.uuid(),
  patch: z.object({
    trackId: z.uuid().optional().describe("Move clip to a different track."),
    startFrame: z.number().int().min(0).optional(),
    endFrame: z.number().int().min(1).optional(),
    sourceStartFrame: z.number().int().min(0).optional(),
    sourceDurationInFrames: z.number().int().min(1).optional(),
    properties: z.record(z.string(), z.any()).optional().describe("Partial property update. Existing fields are preserved."),
  }),
});

const removeClipCommand = z.object({
  cmd: z.literal('remove_clip').describe("Remove a clip from the timeline."),
  clipId: z.uuid(),
});

const singleOpSchema = z.discriminatedUnion('cmd', [
  updateCompositionCommand,
  addTrackCommand,
  updateTrackCommand,
  removeTrackCommand,
  addClipCommand,
  updateClipCommand,
  removeClipCommand,
]);

const batchCommand = z.object({
  cmd: z.literal('batch').describe(
    "Execute multiple timeline operations atomically. All succeed or all fail. Use for compound operations like splitting a clip or swapping track positions."
  ),
  compositionId,
  operations: z.array(singleOpSchema).min(1).max(50),
});

const toolSchema = z.discriminatedUnion('cmd', [
  updateCompositionCommand,
  addTrackCommand,
  updateTrackCommand,
  removeTrackCommand,
  addClipCommand,
  updateClipCommand,
  removeClipCommand,
  batchCommand,
]);

export const timelineEditTool = buildBaseTool({
  name: "timelineEdit",
  description: "Modify a video timeline. Supports adding/removing/updating tracks and clips. Use 'batch' for atomic multi-step operations like splitting clips or rearranging tracks.",
  inputSchema: z.object({ command: toolSchema }),
  execute: async (cmd, { session }) => {
    const input = cmd.command;
    switch (input.cmd) {
      case 'update_composition':
        return executeUpdateComposition(input);
      case 'add_track':
        return executeAddTrack(input);
      case 'update_track':
        return executeUpdateTrack(input);
      case 'remove_track':
        return executeRemoveTrack(input);
      case 'add_clip':
        return executeAddClip(input);
      case 'update_clip':
        return executeUpdateClip(input);
      case 'remove_clip':
        return executeRemoveClip(input);
      case 'batch':
        return executeBatch(input);
      default:
        return failure('Unknown command.');
    }
  },
});

async function executeUpdateComposition(input: z.infer<typeof updateCompositionCommand>) {
  const updated = await repo.updateComposition(input.compositionId, input.patch);
  if (!updated) {
    return failure('Composition not found.');
  }
  return success(`Composition updated. Version: ${updated.version}`);
}

async function executeAddTrack(input: z.infer<typeof addTrackCommand>) {
  const position = input.position ?? await repo.getNextTrackPosition(input.compositionId);
  const track = await repo.createTrack({
    compositionId: input.compositionId,
    type: input.type,
    position,
  });
  return success(`Track created: ID: ${track.id} - Type: ${track.type} - Position: ${track.position}`);
}

async function executeUpdateTrack(input: z.infer<typeof updateTrackCommand>) {
  const updated = await repo.updateTrack(input.trackId, input.patch);
  if (!updated) {
    return failure('Track not found.');
  }
  return success(`Track ${updated.id} updated.`);
}

async function executeRemoveTrack(input: z.infer<typeof removeTrackCommand>) {
  const deleted = await repo.deleteTrack(input.trackId);
  if (!deleted) {
    return failure('Track not found.');
  }
  return success(`Track ${input.trackId} removed (along with its clips).`);
}

async function executeAddClip(input: z.infer<typeof addClipCommand>) {
  const track = await repo.getTrackById(input.trackId);
  if (!track) {
    return failure('Track not found.');
  }

  if (input.endFrame <= input.startFrame) {
    return failure('endFrame must be greater than startFrame.');
  }

  const clip = await repo.createClip({
    trackId: input.trackId,
    compositionId: track.compositionId,
    type: input.type,
    startFrame: input.startFrame,
    endFrame: input.endFrame,
    sourceStartFrame: input.sourceStartFrame,
    sourceDurationInFrames: input.sourceDurationInFrames,
    assetId: input.assetId ?? null,
    properties: input.properties as VideoClipProperties,
  });
  return success(`Clip created: ${clip.id} [${clip.type}] at frames ${clip.startFrame}–${clip.endFrame}`);
}

async function executeUpdateClip(input: z.infer<typeof updateClipCommand>) {
  const updated = await repo.updateClip(input.clipId, input.patch);
  if (!updated) {
    return failure('Clip not found.');
  }
  return success(`Clip ${updated.id} updated.`);
}

async function executeRemoveClip(input: z.infer<typeof removeClipCommand>) {
  const deleted = await repo.deleteClip(input.clipId);
  if (!deleted) {
    return failure('Clip not found.');
  }
  return success(`Clip ${input.clipId} removed.`);
}

async function executeBatch(input: z.infer<typeof batchCommand>) {
  const batchOps: repo.BatchOperation[] = input.operations.map((op) => {
    switch (op.cmd) {
      case 'update_composition':
        return { op: 'update_composition', id: op.compositionId, data: op.patch };
      case 'add_track':
        return {
          op: 'create_track',
          data: {
            compositionId: input.compositionId,
            type: op.type,
            name: op.name,
            position: op.position,
          },
        };
      case 'update_track':
        return { op: 'update_track', id: op.trackId, data: op.patch };
      case 'remove_track':
        return { op: 'delete_track', id: op.trackId };
      case 'add_clip':
        return {
          op: 'create_clip',
          data: {
            trackId: op.trackId,
            compositionId: input.compositionId,
            type: op.type,
            startFrame: op.startFrame,
            endFrame: op.endFrame,
            sourceStartFrame: op.sourceStartFrame,
            sourceDurationInFrames: op.sourceDurationInFrames,
            assetId: op.assetId ?? null,
            properties: op.properties as VideoClipProperties,
          },
        };
      case 'update_clip':
        return { op: 'update_clip', id: op.clipId, data: op.patch };
      case 'remove_clip':
        return { op: 'delete_clip', id: op.clipId };
    }
  });

  try {
    const results = await repo.executeBatch(batchOps);
    return success(`Batch executed: ${results.length} operations completed atomically.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return failure(`Batch failed (all operations rolled back): ${msg}`);
  }
}

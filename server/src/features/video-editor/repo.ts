import { db } from "@/db";
import { videoCompositions, videoTracks, videoClips } from "@/db/schema";
import { eq, and, lte, gt, asc, sql, inArray, gte } from "drizzle-orm";
import type { VideoTrackType, VideoClipProperties, AspectRatio } from "@/type";

// ============================================================================
// COMPOSITIONS
// ============================================================================

export const getCompositionById = async (id: string) => {
  const result = await db
    .select()
    .from(videoCompositions)
    .where(eq(videoCompositions.id, id));
  return result[0] ?? null;
};

export const getCompositionByFileNodeId = async (fileNodeId: string) => {
  const result = await db
    .select()
    .from(videoCompositions)
    .where(eq(videoCompositions.fileNodeId, fileNodeId));
  return result[0] ?? null;
};

export type CreateCompositionData = {
  projectId: string;
  fileNodeId: string;
  fps?: number;
  durationInFrames?: number;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
};

export const createComposition = async (data: CreateCompositionData) => {
  const result = await db
    .insert(videoCompositions)
    .values(data)
    .returning();
  return result[0];
};

export type UpdateCompositionData = {
  fps?: number;
  durationInFrames?: number;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
};

export const updateComposition = async (id: string, data: UpdateCompositionData) => {
  const result = await db
    .update(videoCompositions)
    .set({ ...data, version: sql`${videoCompositions.version} + 1` })
    .where(eq(videoCompositions.id, id))
    .returning();
  return result[0] ?? null;
};

// ============================================================================
// TRACKS
// ============================================================================

export const getTracksByCompositionId = async (compositionId: string, position?: { min?: number, max?: number }) => {
  const minPosition = position?.min;
  const maxPosition = position?.max;
  return db
    .select()
    .from(videoTracks)
    .where(and(
      eq(videoTracks.compositionId, compositionId),
      (minPosition !== undefined) ? gte(videoTracks.position, minPosition) : undefined,
      (maxPosition !== undefined) ? lte(videoTracks.position, maxPosition) : undefined,
    ))
    .orderBy(asc(videoTracks.position));
};

export const getTrackById = async (id: string) => {
  const result = await db
    .select()
    .from(videoTracks)
    .where(eq(videoTracks.id, id));
  return result[0] ?? null;
};

export const getNextTrackPosition = async (compositionId: string) => {
  const result = await db
    .select({ maxPos: sql<number>`coalesce(max(${videoTracks.position}), -1)` })
    .from(videoTracks)
    .where(eq(videoTracks.compositionId, compositionId));
  return (result[0]?.maxPos ?? -1) + 1;
};

export type CreateTrackData = {
  id?: string;
  compositionId: string;
  type: VideoTrackType;
  name?: string;
  position?: number;
  muted?: boolean;
  hidden?: boolean;
};

export const createTrack = async (data: CreateTrackData) => {
  const result = await db
    .insert(videoTracks)
    .values(data)
    .returning();
  return result[0];
};

export type UpdateTrackData = {
  name?: string;
  position?: number;
  muted?: boolean;
  hidden?: boolean;
};

export const updateTrack = async (id: string, data: UpdateTrackData) => {
  const result = await db
    .update(videoTracks)
    .set(data)
    .where(eq(videoTracks.id, id))
    .returning();
  return result[0] ?? null;
};

export const deleteTrack = async (id: string) => {
  const result = await db
    .delete(videoTracks)
    .where(eq(videoTracks.id, id))
    .returning({ id: videoTracks.id });
  return result.length > 0;
};

// ============================================================================
// CLIPS
// ============================================================================

export const getClipsByCompositionId = async (compositionId: string) => {
  return db
    .select()
    .from(videoClips)
    .where(eq(videoClips.compositionId, compositionId))
    .orderBy(asc(videoClips.startFrame));
};

export const getClipsByTrackId = async (trackId: string) => {
  return db
    .select()
    .from(videoClips)
    .where(eq(videoClips.trackId, trackId))
    .orderBy(asc(videoClips.startFrame));
};

export const getClipsAtFrame = async (compositionId: string, frame: number) => {
  return db
    .select()
    .from(videoClips)
    .where(
      and(
        eq(videoClips.compositionId, compositionId),
        lte(videoClips.startFrame, frame),
        gt(videoClips.endFrame, frame),
      )
    )
    .orderBy(asc(videoClips.startFrame));
};

export type ClipFilters = {
  trackId?: string;
  type?: VideoTrackType;
  fromFrame?: number;
  toFrame?: number;
};

export const getClipsByFilters = async (compositionId: string, filters: ClipFilters) => {
  const conditions = [eq(videoClips.compositionId, compositionId)];

  if (filters.trackId) {
    conditions.push(eq(videoClips.trackId, filters.trackId));
  }
  if (filters.type) {
    conditions.push(eq(videoClips.type, filters.type));
  }
  if (filters.fromFrame !== undefined) {
    conditions.push(gt(videoClips.endFrame, filters.fromFrame));
  }
  if (filters.toFrame !== undefined) {
    conditions.push(lte(videoClips.startFrame, filters.toFrame));
  }

  return db
    .select()
    .from(videoClips)
    .where(and(...conditions))
    .orderBy(asc(videoClips.startFrame));
};

export const getClipById = async (id: string) => {
  const result = await db
    .select()
    .from(videoClips)
    .where(eq(videoClips.id, id));
  return result[0] ?? null;
};

export type CreateClipData = {
  id?: string;
  trackId: string;
  compositionId: string;
  type: VideoTrackType;
  startFrame: number;
  endFrame: number;
  sourceStartFrame?: number;
  sourceDurationInFrames: number;
  assetId?: string | null;
  properties: VideoClipProperties;
};

export const createClip = async (data: CreateClipData) => {
  const result = await db
    .insert(videoClips)
    .values(data)
    .returning();
  return result[0];
};

export const createClipsBulk = async (data: CreateClipData[]) => {
  if (data.length === 0) return [];
  return db.insert(videoClips).values(data).returning();
};

export type UpdateClipData = {
  trackId?: string;
  startFrame?: number;
  endFrame?: number;
  sourceStartFrame?: number;
  sourceDurationInFrames?: number;
  properties?: Record<string, unknown>;
};

export const updateClip = async (id: string, data: UpdateClipData) => {
  const { properties, ...scalarFields } = data;

  const setClause: Record<string, unknown> = { ...scalarFields };

  if (properties) {
    setClause.properties = sql`${videoClips.properties} || ${JSON.stringify(properties)}::jsonb`;
  }

  const result = await db
    .update(videoClips)
    .set(setClause)
    .where(eq(videoClips.id, id))
    .returning();
  return result[0] ?? null;
};

export const deleteClip = async (id: string) => {
  const result = await db
    .delete(videoClips)
    .where(eq(videoClips.id, id))
    .returning({ id: videoClips.id });
  return result.length > 0;
};

export const deleteClipsBulk = async (ids: string[]) => {
  if (ids.length === 0) return 0;
  const result = await db
    .delete(videoClips)
    .where(inArray(videoClips.id, ids))
    .returning({ id: videoClips.id });
  return result.length;
};

// ============================================================================
// COMPOSITE READS
// ============================================================================

export const getFullComposition = async (compositionId: string) => {
  const [composition, tracks, clips] = await Promise.all([
    getCompositionById(compositionId),
    getTracksByCompositionId(compositionId),
    getClipsByCompositionId(compositionId),
  ]);
  return { composition, tracks, clips };
};

export const getFullCompositionByFileNodeId = async (fileNodeId: string) => {
  const composition = await getCompositionByFileNodeId(fileNodeId);
  if (!composition) return null;
  const [tracks, clips] = await Promise.all([
    getTracksByCompositionId(composition.id),
    getClipsByCompositionId(composition.id),
  ]);
  return { composition, tracks, clips };
};

// ============================================================================
// BATCH TRANSACTION
// ============================================================================

export type BatchOperation =
  | { op: 'create_track'; data: CreateTrackData }
  | { op: 'update_track'; id: string; data: UpdateTrackData }
  | { op: 'delete_track'; id: string }
  | { op: 'create_clip'; data: CreateClipData }
  | { op: 'update_clip'; id: string; data: UpdateClipData }
  | { op: 'delete_clip'; id: string }
  | { op: 'update_composition'; id: string; data: UpdateCompositionData };

const OP_ORDER: Record<BatchOperation['op'], number> = {
  create_track: 0,
  update_composition: 1,
  update_clip: 2,
  update_track: 3,
  delete_clip: 4,
  delete_track: 5,
  create_clip: 6,
};

export const executeBatch = async (operations: BatchOperation[]) => {
  const sorted = [...operations].sort(
    (a, b) => OP_ORDER[a.op] - OP_ORDER[b.op],
  );

  return db.transaction(async (tx) => {
    const results: Record<string, unknown>[] = [];

    for (const operation of sorted) {
      switch (operation.op) {
        case 'create_track': {
          const r = await tx.insert(videoTracks).values(operation.data).returning();
          results.push({ op: 'create_track', id: r[0].id });
          break;
        }
        case 'update_track': {
          await tx.update(videoTracks).set(operation.data).where(eq(videoTracks.id, operation.id));
          results.push({ op: 'update_track', id: operation.id });
          break;
        }
        case 'delete_track': {
          await tx.delete(videoTracks).where(eq(videoTracks.id, operation.id));
          results.push({ op: 'delete_track', id: operation.id });
          break;
        }
        case 'create_clip': {
          const r = await tx.insert(videoClips).values(operation.data).returning();
          results.push({ op: 'create_clip', id: r[0].id });
          break;
        }
        case 'update_clip': {
          const { properties, ...scalarFields } = operation.data;
          const setClause: Record<string, unknown> = { ...scalarFields };
          if (properties) {
            setClause.properties = sql`${videoClips.properties} || ${JSON.stringify(properties)}::jsonb`;
          }
          await tx.update(videoClips).set(setClause).where(eq(videoClips.id, operation.id));
          results.push({ op: 'update_clip', id: operation.id });
          break;
        }
        case 'delete_clip': {
          await tx.delete(videoClips).where(eq(videoClips.id, operation.id));
          results.push({ op: 'delete_clip', id: operation.id });
          break;
        }
        case 'update_composition': {
          await tx
            .update(videoCompositions)
            .set({ ...operation.data, version: sql`${videoCompositions.version} + 1` })
            .where(eq(videoCompositions.id, operation.id));
          results.push({ op: 'update_composition', id: operation.id });
          break;
        }
      }
    }

    return results;
  });
};

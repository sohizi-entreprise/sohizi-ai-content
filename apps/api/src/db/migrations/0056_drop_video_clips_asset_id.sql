DROP INDEX IF EXISTS "video_clips_asset_id_idx";--> statement-breakpoint
ALTER TABLE "video_clips" DROP CONSTRAINT IF EXISTS "video_clips_asset_id_assets_id_fk";--> statement-breakpoint
ALTER TABLE "video_clips" DROP COLUMN IF EXISTS "asset_id";

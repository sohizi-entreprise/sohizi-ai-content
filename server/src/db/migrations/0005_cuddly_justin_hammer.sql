ALTER TABLE "segments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "segments" CASCADE;--> statement-breakpoint
ALTER TABLE "scenes" DROP CONSTRAINT "scenes_segment_id_segments_id_fk";
--> statement-breakpoint
ALTER TABLE "entities" ALTER COLUMN "name" SET DATA TYPE varchar(150);--> statement-breakpoint
ALTER TABLE "scenes" ALTER COLUMN "content" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "slug" varchar(150) NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "metadata" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "scenes" DROP COLUMN "segment_id";--> statement-breakpoint
ALTER TABLE "scenes" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "scenes" DROP COLUMN "metadata";
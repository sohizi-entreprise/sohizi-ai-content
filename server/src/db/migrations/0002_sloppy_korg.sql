DROP TABLE "visual_settings" CASCADE;--> statement-breakpoint
DROP TABLE "briefs" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "name" TO "title";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "narrative_arcs" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "synopsis" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "outline" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "story_bible" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "script" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" varchar(50) DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "format";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "audience";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "tone";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "genre";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "initial_input";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "constraints";
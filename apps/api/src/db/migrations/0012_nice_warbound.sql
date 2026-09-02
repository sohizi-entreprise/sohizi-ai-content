CREATE TABLE "project_brief_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_brief_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"content" text NOT NULL,
	"additional_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_briefs_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "video_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"composition_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"start_frame" integer NOT NULL,
	"end_frame" integer NOT NULL,
	"source_start_frame" integer DEFAULT 0 NOT NULL,
	"source_duration_in_frames" integer NOT NULL,
	"asset_id" uuid,
	"properties" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_compositions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_node_id" uuid,
	"fps" integer DEFAULT 30 NOT NULL,
	"duration_in_frames" integer DEFAULT 900 NOT NULL,
	"aspect_ratio" varchar(10) DEFAULT '16:9' NOT NULL,
	"width" integer DEFAULT 1920 NOT NULL,
	"height" integer DEFAULT 1080 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"composition_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "display_priority" SET DEFAULT 10000;--> statement-breakpoint
ALTER TABLE "file_nodes" ADD COLUMN "content_editable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brief_attachments" ADD CONSTRAINT "project_brief_attachments_project_brief_id_project_briefs_id_fk" FOREIGN KEY ("project_brief_id") REFERENCES "public"."project_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_brief_attachments" ADD CONSTRAINT "project_brief_attachments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_track_id_video_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."video_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_composition_id_video_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."video_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_compositions" ADD CONSTRAINT "video_compositions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_compositions" ADD CONSTRAINT "video_compositions_file_node_id_file_nodes_id_fk" FOREIGN KEY ("file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_tracks" ADD CONSTRAINT "video_tracks_composition_id_video_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."video_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_brief_attachments_brief_asset_unique" ON "project_brief_attachments" USING btree ("project_brief_id","asset_id");--> statement-breakpoint
CREATE INDEX "project_brief_attachments_asset_id_idx" ON "project_brief_attachments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "project_briefs_project_id_idx" ON "project_briefs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "video_clips_composition_id_start_end_idx" ON "video_clips" USING btree ("composition_id","start_frame","end_frame");--> statement-breakpoint
CREATE INDEX "video_clips_track_id_start_frame_idx" ON "video_clips" USING btree ("track_id","start_frame");--> statement-breakpoint
CREATE INDEX "video_clips_composition_id_type_idx" ON "video_clips" USING btree ("composition_id","type");--> statement-breakpoint
CREATE INDEX "video_clips_asset_id_idx" ON "video_clips" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_compositions_file_node_id_unique" ON "video_compositions" USING btree ("file_node_id");--> statement-breakpoint
CREATE INDEX "video_compositions_project_id_idx" ON "video_compositions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "video_tracks_composition_id_position_idx" ON "video_tracks" USING btree ("composition_id","position");--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "metadata";
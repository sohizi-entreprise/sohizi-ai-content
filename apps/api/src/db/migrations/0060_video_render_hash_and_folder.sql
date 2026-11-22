ALTER TABLE "video_render_jobs" ADD COLUMN "folder_id" uuid REFERENCES "public"."file_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "file_node_id" uuid REFERENCES "public"."file_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "composition_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "output_url" text;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "output_storage_key" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_render_jobs_composition_hash_idx" ON "video_render_jobs" USING btree ("composition_id","composition_hash");

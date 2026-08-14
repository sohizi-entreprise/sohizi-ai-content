CREATE TYPE "public"."video_render_job_status" AS ENUM('queued', 'rendering', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "video_render_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"composition_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "video_render_job_status" DEFAULT 'queued' NOT NULL,
	"composition_version" integer NOT NULL,
	"fps" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"duration_in_frames" integer NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"remote_job_id" varchar(100) NOT NULL,
	"output_key" text,
	"output_size_in_bytes" bigint,
	"progress" integer DEFAULT 0 NOT NULL,
	"failure_code" varchar(100),
	"failure_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD CONSTRAINT "video_render_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD CONSTRAINT "video_render_jobs_composition_id_video_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."video_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD CONSTRAINT "video_render_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_render_jobs_remote_job_id_unique" ON "video_render_jobs" USING btree ("remote_job_id");--> statement-breakpoint
CREATE INDEX "video_render_jobs_project_created_at_idx" ON "video_render_jobs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "video_render_jobs_composition_status_idx" ON "video_render_jobs" USING btree ("composition_id","status");--> statement-breakpoint
CREATE INDEX "video_render_jobs_user_id_idx" ON "video_render_jobs" USING btree ("user_id");

CREATE TABLE "analytics_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"choice" varchar(16) NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"user_id" text,
	"chosen_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "analytics_consent_id" uuid;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "analytics_consent_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_consents" ADD CONSTRAINT "analytics_consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_analytics_consent_id_analytics_consents_id_fk" FOREIGN KEY ("analytics_consent_id") REFERENCES "public"."analytics_consents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD CONSTRAINT "video_render_jobs_analytics_consent_id_analytics_consents_id_fk" FOREIGN KEY ("analytics_consent_id") REFERENCES "public"."analytics_consents"("id") ON DELETE set null ON UPDATE no action;
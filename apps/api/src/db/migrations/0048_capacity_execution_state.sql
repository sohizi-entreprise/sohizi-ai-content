ALTER TABLE "generation_requests" ADD COLUMN "capacity_account_id" text;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "capacity_lease" jsonb;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "user_lease" jsonb;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "submit_state" varchar(40);--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "provider_request_id" text;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "billing_reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "enqueued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "capacity_account_id" text;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "capacity_lease" jsonb;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "user_lease" jsonb;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "submit_state" varchar(40);--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "poller_enqueued_at" timestamp with time zone;

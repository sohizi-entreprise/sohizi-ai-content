ALTER TABLE "video_render_jobs" ADD COLUMN "billing_reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "output_bucket" text;--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD COLUMN "function_name" varchar(200);--> statement-breakpoint
ALTER TABLE "video_render_jobs" ADD CONSTRAINT "video_render_jobs_billing_reservation_id_billing_reservations_id_fk" FOREIGN KEY ("billing_reservation_id") REFERENCES "public"."billing_reservations"("id") ON DELETE set null ON UPDATE no action;
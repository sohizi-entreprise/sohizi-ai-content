ALTER TABLE "generation_requests" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "generation_requests" ALTER COLUMN "status" SET DEFAULT 'ENQUEUED';--> statement-breakpoint
ALTER TABLE "generation_requests" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
DROP TYPE IF EXISTS "public"."generation_request_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."generation_request_type";
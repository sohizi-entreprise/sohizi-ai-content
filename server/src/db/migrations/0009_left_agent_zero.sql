ALTER TABLE "generation_requests" ALTER COLUMN "type" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
CREATE INDEX "generation_requests_status_idx" ON "generation_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "generation_requests" DROP COLUMN "prompt";
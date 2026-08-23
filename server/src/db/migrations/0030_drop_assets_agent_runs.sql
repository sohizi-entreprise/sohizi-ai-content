ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_generation_request_id_assets_agent_runs_id_fk";--> statement-breakpoint
UPDATE "assets"
SET "generation_request_id" = NULL
WHERE "generation_request_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "generation_requests"
    WHERE "generation_requests"."id" = "assets"."generation_request_id"
  );--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP TABLE "assets_agent_runs";

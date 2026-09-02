ALTER TABLE "assets_agent_runs" DROP COLUMN "assets";--> statement-breakpoint
ALTER TABLE "assets_agent_runs" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_generation_request_id_generation_requests_id_fk";--> statement-breakpoint
UPDATE "assets"
SET "generation_request_id" = NULL
WHERE "generation_request_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "assets_agent_runs"
    WHERE "assets_agent_runs"."id" = "assets"."generation_request_id"
  );--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_generation_request_id_assets_agent_runs_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."assets_agent_runs"("id") ON DELETE set null ON UPDATE no action;

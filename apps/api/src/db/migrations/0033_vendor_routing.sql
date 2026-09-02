ALTER TABLE "llm_vendors" ADD COLUMN "kind" varchar(20) DEFAULT 'llm' NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_vendors" ADD COLUMN "rate_limit" jsonb DEFAULT '{"rpm":60,"burst":60,"maxConcurrency":10}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_vendors" ADD COLUMN "circuit_config" jsonb;--> statement-breakpoint
UPDATE "llm_vendors" SET "kind" = 'media' WHERE "name" = 'wavespeed';--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" ADD COLUMN "priority" integer DEFAULT 100 NOT NULL;

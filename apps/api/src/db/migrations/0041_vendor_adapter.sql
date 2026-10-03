ALTER TABLE "llm_vendors" ADD COLUMN "adapter" varchar(100);--> statement-breakpoint
UPDATE "llm_vendors" SET "adapter" = "name" WHERE "adapter" IS NULL;--> statement-breakpoint
ALTER TABLE "llm_vendors" ALTER COLUMN "adapter" SET NOT NULL;

ALTER TABLE "commands" ADD COLUMN "visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "commands" SET "visible" = true WHERE "is_public" = true;

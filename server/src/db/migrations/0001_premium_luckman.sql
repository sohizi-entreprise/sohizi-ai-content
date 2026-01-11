CREATE TYPE "public"."generation_request_status" AS ENUM('ENQUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."generation_request_type" AS ENUM('GENERATE_BRIEF', 'GENERATE_SEGMENT', 'GENERATE_SCENE', 'GENERATE_SHOT', 'GENERATE_ENTITY', 'GENERATE_IMAGE');--> statement-breakpoint
CREATE TABLE "generation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "generation_request_status" DEFAULT 'ENQUEUED' NOT NULL,
	"type" "generation_request_type" NOT NULL,
	"prompt" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "briefs" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "briefs" ALTER COLUMN "logline" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "language" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "language" SET DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "audience" varchar(100) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "genre" varchar(100);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "initial_input" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "constraints" jsonb;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" DROP COLUMN "audience";--> statement-breakpoint
ALTER TABLE "briefs" DROP COLUMN "tone";--> statement-breakpoint
ALTER TABLE "briefs" DROP COLUMN "genre";--> statement-breakpoint
ALTER TABLE "briefs" DROP COLUMN "constraints";
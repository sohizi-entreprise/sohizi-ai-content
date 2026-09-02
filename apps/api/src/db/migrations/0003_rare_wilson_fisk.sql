CREATE TABLE "checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"state" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_models" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	"api_name" varchar(50) NOT NULL,
	"metadata" jsonb,
	"pricing" jsonb,
	"category" varchar(50)[] NOT NULL,
	"recommended_usage" varchar(50)[],
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE IF EXISTS "agent_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "agent_runs" CASCADE;--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_run_id_agent_runs_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "messages_run_id_idx";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkpoints_conversation_id_idx" ON "checkpoints" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkpoints_project_id_conversation_id_unique" ON "checkpoints" USING btree ("project_id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "llm_models_provider_api_name_unique" ON "llm_models" USING btree ("provider","api_name");--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN IF EXISTS "run_id";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN IF EXISTS "metadata";
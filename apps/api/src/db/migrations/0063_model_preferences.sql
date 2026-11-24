CREATE TABLE IF NOT EXISTS "model_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action,
  "type" varchar(50) NOT NULL,
  "key" varchar(100) NOT NULL,
  "model_id" varchar(50) NOT NULL REFERENCES "public"."llm_models"("id") ON DELETE cascade ON UPDATE no action,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_preferences_system_key_unique" ON "model_preferences" USING btree ("key") WHERE "project_id" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_preferences_project_id_key_unique" ON "model_preferences" USING btree ("project_id","key") WHERE "project_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_preferences_project_id_idx" ON "model_preferences" USING btree ("project_id");

CREATE TABLE IF NOT EXISTS "feedbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action,
  "type" varchar(50) NOT NULL,
  "content" text NOT NULL,
  "status" varchar(50) DEFAULT 'open' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedbacks_user_id_idx" ON "feedbacks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedbacks_type_status_created_at_idx" ON "feedbacks" USING btree ("type","status","created_at");

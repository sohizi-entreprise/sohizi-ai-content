CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"scope" varchar(50) NOT NULL,
	"loading_policy" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_project_id_loading_policy_idx" ON "memories" USING btree ("project_id","loading_policy");--> statement-breakpoint
CREATE INDEX "memories_user_id_loading_policy_idx" ON "memories" USING btree ("user_id","loading_policy");--> statement-breakpoint
CREATE INDEX "memories_last_used_at_idx" ON "memories" USING btree ("last_used_at");

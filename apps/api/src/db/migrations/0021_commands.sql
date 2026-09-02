CREATE TABLE "commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"action" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"project_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commands_project_id_idx" ON "commands" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commands_name_project_unique" ON "commands" USING btree ("name","project_id");

CREATE TABLE "pending_file_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_node_id" uuid NOT NULL,
	"operation" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"diff_applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_file_operations" ADD CONSTRAINT "pending_file_operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_file_operations" ADD CONSTRAINT "pending_file_operations_file_node_id_file_nodes_id_fk" FOREIGN KEY ("file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_file_operations_file_node_id_operation_unique" ON "pending_file_operations" USING btree ("file_node_id","operation");--> statement-breakpoint
CREATE INDEX "pending_file_operations_project_id_idx" ON "pending_file_operations" USING btree ("project_id");
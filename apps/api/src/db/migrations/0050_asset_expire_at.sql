ALTER TABLE "assets" ADD COLUMN "expire_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "assets_expire_at_idx" ON "assets" USING btree ("expire_at") WHERE "expire_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_file_node_id_file_nodes_id_fk";--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_file_node_id_file_nodes_id_fk" FOREIGN KEY ("file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE set null ON UPDATE no action;

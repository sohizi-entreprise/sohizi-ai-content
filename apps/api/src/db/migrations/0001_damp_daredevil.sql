ALTER TABLE "file_nodes" RENAME COLUMN "is_built_in" TO "editable";--> statement-breakpoint
ALTER TABLE "file_node_relationships" DROP CONSTRAINT IF EXISTS "file_node_relationships_project_id_file_node_id_related_file_node_id_file_nodes_project_id_id_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "metadata" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "brief";
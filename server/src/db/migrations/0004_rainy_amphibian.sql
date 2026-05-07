CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "file_nodes_name_trgm_idx" ON "file_nodes" USING gin ("name" gin_trgm_ops);
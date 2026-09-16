CREATE EXTENSION IF NOT EXISTS ltree;--> statement-breakpoint
ALTER TABLE "file_nodes" ADD COLUMN "path" ltree;--> statement-breakpoint
WITH RECURSIVE paths AS (
	SELECT
		id,
		project_id,
		name::ltree AS path
	FROM file_nodes
	WHERE parent_id IS NULL
	UNION ALL
	SELECT
		child.id,
		child.project_id,
		parent.path || child.name::ltree
	FROM file_nodes child
	JOIN paths parent
		ON child.parent_id = parent.id
		AND child.project_id = parent.project_id
)
UPDATE file_nodes
SET path = paths.path
FROM paths
WHERE file_nodes.id = paths.id;--> statement-breakpoint
ALTER TABLE "file_nodes" ALTER COLUMN "path" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "file_nodes_project_id_path_unique" ON "file_nodes" USING btree ("project_id","path");--> statement-breakpoint
CREATE INDEX "file_nodes_path_gist_idx" ON "file_nodes" USING gist ("path");

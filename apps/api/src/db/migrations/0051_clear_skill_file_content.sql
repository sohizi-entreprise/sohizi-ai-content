-- Skill description and instructions live on the skills table.
-- Drop the copied markdown stored on skill file content rows.
UPDATE file_node_contents AS content
SET content = NULL
FROM file_nodes AS node
WHERE node.id = content.file_node_id
  AND node.project_id = content.project_id
  AND node.type = 'skill';

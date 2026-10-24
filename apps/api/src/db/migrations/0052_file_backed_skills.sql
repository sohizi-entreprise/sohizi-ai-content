-- Make project skill files self-contained before removing the legacy skills rows.
UPDATE file_node_contents AS content
SET
  content = concat(
    E'---\n',
    CASE
      WHEN skill.description = '' THEN 'description: ""'
      ELSE concat(
        'description: |',
        E'\n',
        regexp_replace(skill.description, '(^|\n)', E'\\1  ', 'g')
      )
    END,
    E'\n---\n',
    skill.instructions
  ),
  updated_at = now()
FROM skills AS skill
WHERE skill.file_node_id = content.file_node_id
  AND content.project_id = (
    SELECT node.project_id
    FROM file_nodes AS node
    WHERE node.id = skill.file_node_id
  );

-- Old deployments can have skill content rows cleared by migration 0051.
-- Create a missing content row before writing the canonical markdown document.
INSERT INTO file_node_contents (file_node_id, project_id, content)
SELECT
  skill.file_node_id,
  node.project_id,
  concat(
    E'---\n',
    CASE
      WHEN skill.description = '' THEN 'description: ""'
      ELSE concat(
        'description: |',
        E'\n',
        regexp_replace(skill.description, '(^|\n)', E'\\1  ', 'g')
      )
    END,
    E'\n---\n',
    skill.instructions
  )
FROM skills AS skill
JOIN file_nodes AS node ON node.id = skill.file_node_id
LEFT JOIN file_node_contents AS content
  ON content.file_node_id = skill.file_node_id
WHERE skill.file_node_id IS NOT NULL
  AND content.file_node_id IS NULL;

UPDATE file_nodes AS node
SET metadata = coalesce(node.metadata, '{}'::jsonb) || jsonb_build_object(
  'status', skill.status,
  'visibility', skill.visibility
)
FROM skills AS skill
WHERE node.id = skill.file_node_id;

ALTER TABLE skill_categories ADD COLUMN file_node_id uuid;

UPDATE skill_categories AS category
SET file_node_id = skill.file_node_id
FROM skills AS skill
WHERE category.skill_id = skill.id
  AND skill.file_node_id IS NOT NULL;

-- Catalog-only skills intentionally have no backing project file.
DELETE FROM skill_categories WHERE file_node_id IS NULL;

ALTER TABLE skill_categories DROP COLUMN skill_id CASCADE;
ALTER TABLE skill_categories
  ALTER COLUMN file_node_id SET NOT NULL,
  ADD CONSTRAINT skill_categories_file_node_id_file_nodes_id_fk
    FOREIGN KEY (file_node_id) REFERENCES file_nodes(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX skill_categories_file_node_id_category_id_unique
  ON skill_categories (file_node_id, category_id);

DROP TABLE skills;

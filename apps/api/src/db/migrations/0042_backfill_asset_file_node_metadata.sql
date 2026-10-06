-- Copy linked asset details onto file nodes for directory previews. Assets remain unchanged.
-- Legacy nodes with multiple linked assets use the most recently updated asset.
WITH latest_assets AS (
  SELECT DISTINCT ON (project_id, file_node_id)
    project_id,
    file_node_id,
    metadata,
    url,
    storage_key
  FROM assets
  WHERE file_node_id IS NOT NULL
  ORDER BY project_id, file_node_id, updated_at DESC, id DESC
)
UPDATE file_nodes AS node
SET metadata = COALESCE(node.metadata, '{}'::jsonb)
  || COALESCE(latest_assets.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'url', latest_assets.url,
    'storageKey', latest_assets.storage_key
  )
FROM latest_assets
WHERE node.id = latest_assets.file_node_id
  AND node.project_id = latest_assets.project_id;

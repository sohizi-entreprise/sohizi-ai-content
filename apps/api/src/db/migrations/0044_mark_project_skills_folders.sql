-- Mark existing /root/core/skills directories as skill folders.
UPDATE file_nodes AS skill_folder
SET type = 'skill'
FROM file_nodes AS core_folder
JOIN file_nodes AS root_folder
  ON root_folder.id = core_folder.parent_id
  AND root_folder.project_id = core_folder.project_id
WHERE skill_folder.parent_id = core_folder.id
  AND skill_folder.project_id = core_folder.project_id
  AND skill_folder.directory = true
  AND skill_folder.name = 'skills'
  AND skill_folder.type IS DISTINCT FROM 'skill'
  AND core_folder.directory = true
  AND core_folder.name = 'core'
  AND root_folder.directory = true
  AND root_folder.name = 'root'
  AND root_folder.parent_id IS NULL;

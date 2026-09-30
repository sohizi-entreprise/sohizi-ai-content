ALTER TABLE "file_nodes" ADD COLUMN "type" varchar(50);--> statement-breakpoint
UPDATE file_nodes SET
	"type" = CASE "format"
		WHEN 'markdown' THEN 'document'
		WHEN 'json' THEN 'document'
		WHEN 'skill' THEN 'skill'
		WHEN 'storyboard' THEN 'storyboard'
		WHEN 'image' THEN 'image'
		WHEN 'video' THEN 'video'
		WHEN 'audio' THEN 'audio'
		WHEN 'html' THEN 'document'
		WHEN 'document' THEN 'document'
		WHEN 'video-editor' THEN 'video-editor'
		WHEN 'ai-generated' THEN 'document'
		ELSE CASE WHEN directory = true THEN NULL ELSE 'document' END
	END,
	"format" = CASE "format"
		WHEN 'markdown' THEN 'markdown'
		WHEN 'json' THEN 'json'
		WHEN 'skill' THEN 'markdown'
		WHEN 'storyboard' THEN 'markdown'
		WHEN 'image' THEN 'file'
		WHEN 'video' THEN 'file'
		WHEN 'audio' THEN 'file'
		WHEN 'html' THEN 'html'
		WHEN 'document' THEN 'file'
		WHEN 'video-editor' THEN 'json'
		WHEN 'ai-generated' THEN 'json'
		ELSE "format"
	END;--> statement-breakpoint
UPDATE file_nodes AS fn
SET "format" = 'pdf'
FROM assets AS a
WHERE a.file_node_id = fn.id
	AND a.metadata->>'contentType' = 'application/pdf'
	AND fn.type = 'document'
	AND fn.format = 'file';

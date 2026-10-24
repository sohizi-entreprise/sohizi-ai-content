-- HTML is no longer a video-editor clip or track type.
DELETE FROM "video_clips" WHERE "type" = 'html';--> statement-breakpoint
DELETE FROM "video_tracks" WHERE "type" = 'html';

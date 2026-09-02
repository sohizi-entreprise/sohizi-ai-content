INSERT INTO "models_options" ("id", "key", "label", "description", "options", "default", "active", "provider")
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'resolution',
    'Resolution',
    'Output resolution for image and video generation.',
    '[{"value":"720p","label":"720p"},{"value":"1080p","label":"1080p"},{"value":"4K","label":"4K"}]'::jsonb,
    '720p',
    true,
    'generic'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'cameraAngle',
    'Camera angle',
    'Preferred camera angle for image generation.',
    '[{"value":"eye-level","label":"Eye level"},{"value":"low-angle","label":"Low angle"},{"value":"high-angle","label":"High angle"},{"value":"over-the-shoulder","label":"Over the shoulder"},{"value":"drone","label":"Drone"}]'::jsonb,
    'eye-level',
    true,
    'generic'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'aspectRatio',
    'Aspect ratio',
    'Output aspect ratio for image and video generation.',
    '[{"value":"1:1","label":"1:1"},{"value":"4:3","label":"4:3"},{"value":"16:9","label":"16:9"},{"value":"9:16","label":"9:16"}]'::jsonb,
    '16:9',
    true,
    'generic'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'variations',
    'Variations',
    'Number of variations to generate.',
    '[{"value":"1","label":"1"},{"value":"2","label":"2"},{"value":"3","label":"3"},{"value":"4","label":"4"}]'::jsonb,
    '1',
    true,
    'generic'
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    'duration',
    'Duration',
    'Duration in seconds for video or audio generation.',
    '[{"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"5","label":"5"},{"value":"6","label":"6"}]'::jsonb,
    '6',
    true,
    'generic'
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'genre',
    'Genre',
    'Voice or style genre for audio generation.',
    '[{"value":"narrator","label":"Narrator"},{"value":"warm","label":"Warm"},{"value":"dramatic","label":"Dramatic"},{"value":"documentary","label":"Documentary"}]'::jsonb,
    'narrator',
    true,
    'generic'
  )
ON CONFLICT DO NOTHING;

--> statement-breakpoint
WITH image_models AS (
  SELECT "id" FROM "llm_models"
  WHERE "id" IN (
    'black-forest-labs/flux.2-max',
    'openai/gpt-image-2',
    'openai/gpt-image-1.5',
    'google/gemini-3.1-flash-image-preview',
    'google/gemini-3-pro-image-preview',
    'bytedance/seedream-4.5',
    'bytedance/seedream-5-lite'
  )
),
image_options AS (
  SELECT "id" FROM "models_options"
  WHERE "key" IN ('resolution', 'cameraAngle', 'aspectRatio', 'variations')
    AND "provider" = 'generic'
)
INSERT INTO "models_options_and_models" ("option_id", "model_id")
SELECT image_options.id, image_models.id
FROM image_options
CROSS JOIN image_models
ON CONFLICT DO NOTHING;

--> statement-breakpoint
WITH video_models AS (
  SELECT "id" FROM "llm_models"
  WHERE "id" IN (
    'alibaba/wan-2.6',
    'kling/kling-v3',
    'bytedance/seedance-2.0'
  )
),
video_options AS (
  SELECT "id" FROM "models_options"
  WHERE "key" IN ('resolution', 'duration', 'aspectRatio', 'variations')
    AND "provider" = 'generic'
)
INSERT INTO "models_options_and_models" ("option_id", "model_id")
SELECT video_options.id, video_models.id
FROM video_options
CROSS JOIN video_models
ON CONFLICT DO NOTHING;

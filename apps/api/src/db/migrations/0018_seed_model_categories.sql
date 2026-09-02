INSERT INTO "model_categories" ("name", "description")
VALUES
  ('text-to-image', 'Models that generate images from text prompts.'),
  ('image-to-image', 'Models that transform or edit images using image inputs.'),
  ('image-to-video', 'Models that generate videos from image inputs.'),
  ('text-to-video', 'Models that generate videos from text prompts.'),
  ('text-to-speech', 'Models that generate spoken audio from text input.'),
  ('video-to-text', 'Models that extract text or captions from video input.'),
  ('image-to-text', 'Models that describe or extract text from images.'),
  ('speech-to-text', 'Models that transcribe spoken audio into text.'),
  ('leading-agent', 'Models approved for primary agent or lead reasoning tasks.'),
  ('video-to-video', 'Models that transform existing videos into new videos.'),
  ('text-to-text', 'Models that generate or transform text from text input.')
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description";

--> statement-breakpoint
INSERT INTO "llm_models" ("id", "provider", "name", "api_name", "pricing", "enabled")
VALUES
  (
    'openai/gpt-5.2',
    'openai',
    'GPT-5.2',
    'gpt-5.2',
    '{"currency":"USD","unit":"per_1m_tokens","basis":"request_tokens","input":[{"up_to":null,"rate":1.75}],"output":[{"up_to":null,"rate":14}],"cached_input":[{"up_to":null,"rate":0.175}]}'::jsonb,
    true
  ),
  (
    'openai/gpt-5.1',
    'openai',
    'GPT-5.1',
    'gpt-5.1',
    '{"currency":"USD","unit":"per_1m_tokens","basis":"request_tokens","input":[{"up_to":null,"rate":1.25}],"output":[{"up_to":null,"rate":10}],"cached_input":[{"up_to":null,"rate":0.125}]}'::jsonb,
    true
  ),
  (
    'openai/gpt-5-mini',
    'openai',
    'GPT-5-mini',
    'gpt-5-mini',
    '{"currency":"USD","unit":"per_1m_tokens","basis":"request_tokens","input":[{"up_to":null,"rate":0.25}],"output":[{"up_to":null,"rate":2}],"cached_input":[{"up_to":null,"rate":0.025}]}'::jsonb,
    true
  ),
  (
    'openai/gpt-5-nano',
    'openai',
    'GPT-5-nano',
    'gpt-5-nano',
    '{"currency":"USD","unit":"per_1m_tokens","basis":"request_tokens","input":[{"up_to":null,"rate":0.05}],"output":[{"up_to":null,"rate":0.4}],"cached_input":[{"up_to":null,"rate":0.005}]}'::jsonb,
    true
  ),
  (
    'openai/gpt-4.1',
    'openai',
    'GPT-4.1',
    'gpt-4.1',
    '{"currency":"USD","unit":"per_1m_tokens","basis":"request_tokens","input":[{"up_to":null,"rate":2}],"output":[{"up_to":null,"rate":8}],"cached_input":[{"up_to":null,"rate":0.5}]}'::jsonb,
    true
  ),
  (
    'black-forest-labs/flux.2-max',
    'black-forest-labs',
    'Flux 2 Max',
    'flux.2-max',
    null,
    true
  ),
  (
    'openai/gpt-image-2',
    'openai',
    'GPT Image 2',
    'gpt-image-2',
    null,
    true
  ),
  (
    'openai/gpt-image-1.5',
    'openai',
    'GPT Image 1.5',
    'gpt-image-1.5',
    null,
    true
  ),
  (
    'google/gemini-3.1-flash-image-preview',
    'google',
    'Gemini 3.1 Flash Image Preview',
    'gemini-3.1-flash-image-preview',
    null,
    true
  ),
  (
    'google/gemini-3-pro-image-preview',
    'google',
    'Gemini 3 Pro Image Preview',
    'gemini-3-pro-image-preview',
    null,
    true
  ),
  (
    'bytedance/seedream-4.5',
    'bytedance',
    'Seedream 4.5',
    'seedream-4.5',
    null,
    true
  ),
  (
    'bytedance/seedream-5-lite',
    'bytedance',
    'Seedream 5 Lite',
    'seedream-5-lite',
    null,
    true
  ),
  (
    'alibaba/wan-2.6',
    'alibaba',
    'Wan 2.6',
    'wan-2.6',
    null,
    true
  ),
  (
    'kling/kling-v3',
    'kling',
    'Kling V3',
    'kling-v3',
    null,
    true
  ),
  (
    'bytedance/seedance-2.0',
    'bytedance',
    'Seedance 2.0',
    'seedance-2.0',
    null,
    true
  )
ON CONFLICT ("id") DO UPDATE
SET
  "provider" = EXCLUDED."provider",
  "name" = EXCLUDED."name",
  "api_name" = EXCLUDED."api_name",
  "pricing" = EXCLUDED."pricing",
  "enabled" = EXCLUDED."enabled";

--> statement-breakpoint
WITH model_category_pairs AS (
  SELECT *
  FROM (
    VALUES
      ('openai/gpt-5.2', 'text-to-text'),
      ('openai/gpt-5.2', 'leading-agent'),
      ('openai/gpt-5.1', 'text-to-text'),
      ('openai/gpt-5.1', 'leading-agent'),
      ('openai/gpt-5-mini', 'text-to-text'),
      ('openai/gpt-5-nano', 'text-to-text'),
      ('openai/gpt-4.1', 'text-to-text'),
      ('openai/gpt-4.1', 'leading-agent'),
      ('black-forest-labs/flux.2-max', 'text-to-image'),
      ('black-forest-labs/flux.2-max', 'image-to-image'),
      ('openai/gpt-image-2', 'text-to-image'),
      ('openai/gpt-image-2', 'image-to-image'),
      ('openai/gpt-image-1.5', 'text-to-image'),
      ('openai/gpt-image-1.5', 'image-to-image'),
      ('google/gemini-3.1-flash-image-preview', 'text-to-image'),
      ('google/gemini-3.1-flash-image-preview', 'image-to-image'),
      ('google/gemini-3-pro-image-preview', 'text-to-image'),
      ('google/gemini-3-pro-image-preview', 'image-to-image'),
      ('bytedance/seedream-4.5', 'text-to-image'),
      ('bytedance/seedream-4.5', 'image-to-image'),
      ('bytedance/seedream-5-lite', 'text-to-image'),
      ('bytedance/seedream-5-lite', 'image-to-image'),
      ('alibaba/wan-2.6', 'text-to-video'),
      ('kling/kling-v3', 'text-to-video'),
      ('bytedance/seedance-2.0', 'text-to-video'),
      ('bytedance/seedance-2.0', 'video-to-video')
  ) AS pairs(model_id, category_name)
)
INSERT INTO "models_and_categories" ("model_id", "category_id")
SELECT
  pairs.model_id,
  categories.id
FROM model_category_pairs AS pairs
JOIN "model_categories" AS categories
  ON categories."name" = pairs.category_name
ON CONFLICT ("model_id", "category_id") DO NOTHING;

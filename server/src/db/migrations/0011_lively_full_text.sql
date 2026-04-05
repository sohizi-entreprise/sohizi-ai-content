CREATE OR REPLACE FUNCTION public.scene_content_search_text(scene_content jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    string_agg(
      CASE
        WHEN block->>'type' = 'dialogue' THEN
          concat_ws(
            E'\n',
            nullif(block->>'character', ''),
            CASE
              WHEN nullif(block->>'parenthetical', '') IS NOT NULL
                THEN '(' || nullif(block->>'parenthetical', '') || ')'
              ELSE NULL
            END,
            nullif(block->>'text', '')
          )
        ELSE
          coalesce(block->>'text', '')
      END,
      E'\n'
      ORDER BY ordinality
    ),
    ''
  )
  FROM jsonb_array_elements(COALESCE(scene_content, '[]'::jsonb)) WITH ORDINALITY AS item(block, ordinality)
$$;--> statement-breakpoint

ALTER TABLE "projects"
ADD COLUMN "phase" varchar(50) DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint

ALTER TABLE "scenes"
ADD COLUMN "full_text" tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple', public.scene_content_search_text("content"))
) STORED;--> statement-breakpoint

CREATE INDEX "scenes_full_text_idx" ON "scenes" USING gin ("full_text");--> statement-breakpoint

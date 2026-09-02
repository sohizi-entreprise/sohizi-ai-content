ALTER TABLE "llm_models" ADD COLUMN "pricing" jsonb;--> statement-breakpoint
UPDATE "llm_models" AS m
SET "pricing" = jsonb_strip_nulls(jsonb_build_object(
	'unit', 'per_1m_tokens',
	'input', (
		SELECT (elem->>'rate')::double precision
		FROM jsonb_array_elements(COALESCE(v."pricing"->'input', '[]'::jsonb)) AS elem
		ORDER BY CASE WHEN elem->>'up_to' IS NULL THEN 0 ELSE 1 END
		LIMIT 1
	),
	'output', (
		SELECT (elem->>'rate')::double precision
		FROM jsonb_array_elements(COALESCE(v."pricing"->'output', '[]'::jsonb)) AS elem
		ORDER BY CASE WHEN elem->>'up_to' IS NULL THEN 0 ELSE 1 END
		LIMIT 1
	),
	'cached_input', (
		SELECT (elem->>'rate')::double precision
		FROM jsonb_array_elements(COALESCE(v."pricing"->'cached_input', '[]'::jsonb)) AS elem
		ORDER BY CASE WHEN elem->>'up_to' IS NULL THEN 0 ELSE 1 END
		LIMIT 1
	)
))
FROM (
	SELECT DISTINCT ON ("model_id") "model_id", "pricing"
	FROM "llm_vendors_and_models"
	WHERE "pricing" IS NOT NULL
		AND "pricing"->>'unit' = 'per_1m_tokens'
	ORDER BY "model_id"
) AS v
WHERE v."model_id" = m."id"
	AND (v."pricing"->'input') IS NOT NULL
	AND (v."pricing"->'output') IS NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" DROP COLUMN "pricing";--> statement-breakpoint
ALTER TABLE "models_and_parameters" DROP COLUMN "provider_param_name";--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ADD COLUMN "price_multiplier" numeric(10, 4);

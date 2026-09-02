INSERT INTO "llm_vendors" ("name", "enabled")
VALUES ('openrouter', true)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
INSERT INTO "llm_vendors_and_models" ("vendor_id", "model_id", "api_name", "pricing", "enabled")
SELECT v."id", m."id", m."id", m."pricing", true
FROM "llm_models" m
INNER JOIN "llm_vendors" v ON v."name" = 'openrouter'
WHERE NOT EXISTS (
  SELECT 1
  FROM "llm_vendors_and_models" existing
  WHERE existing."vendor_id" = v."id"
    AND existing."model_id" = m."id"
);--> statement-breakpoint
DROP INDEX "llm_models_provider_api_name_unique";--> statement-breakpoint
ALTER TABLE "llm_models" DROP COLUMN "api_name";--> statement-breakpoint
ALTER TABLE "llm_models" DROP COLUMN "pricing";

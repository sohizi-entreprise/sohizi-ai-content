CREATE TABLE "parameter_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parameter_id" uuid NOT NULL,
	"label" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models_and_parameter_options" (
	"model_id" varchar(50) NOT NULL,
	"parameter_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_and_parameter_options_model_id_parameter_id_option_id_pk" PRIMARY KEY("model_id","parameter_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "llm_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_vendors_and_models" (
	"vendor_id" uuid NOT NULL,
	"model_id" varchar(50) NOT NULL,
	"api_name" varchar(50) NOT NULL,
	"pricing" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "llm_vendors_and_models_vendor_id_model_id_pk" PRIMARY KEY("vendor_id","model_id")
);
--> statement-breakpoint
CREATE TABLE "llm_vendors_and_parameters" (
	"vendor_id" uuid NOT NULL,
	"parameter_id" uuid NOT NULL,
	"vendor_param_name" varchar(100),
	"vendor_default_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "llm_vendors_and_parameters_vendor_id_parameter_id_pk" PRIMARY KEY("vendor_id","parameter_id")
);
--> statement-breakpoint
CREATE TABLE "llm_vendors_and_parameter_options" (
	"vendor_id" uuid NOT NULL,
	"parameter_option_id" uuid NOT NULL,
	"vendor_option_value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "llm_vendors_and_parameter_options_vendor_id_parameter_option_id_pk" PRIMARY KEY("vendor_id","parameter_option_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_options_parameter_id_id_unique" ON "parameter_options" USING btree ("parameter_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_options_parameter_id_value_unique" ON "parameter_options" USING btree ("parameter_id","value");
--> statement-breakpoint
CREATE INDEX "parameter_options_value_idx" ON "parameter_options" USING btree ("value");
--> statement-breakpoint
CREATE UNIQUE INDEX "llm_vendors_name_unique" ON "llm_vendors" USING btree ("name");
--> statement-breakpoint
ALTER TABLE "parameter_options" ADD CONSTRAINT "parameter_options_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ADD CONSTRAINT "models_and_parameter_options_model_parameter_fk" FOREIGN KEY ("model_id","parameter_id") REFERENCES "public"."models_and_parameters"("model_id","parameter_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ADD CONSTRAINT "models_and_parameter_options_parameter_option_fk" FOREIGN KEY ("parameter_id","option_id") REFERENCES "public"."parameter_options"("parameter_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" ADD CONSTRAINT "llm_vendors_and_models_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" ADD CONSTRAINT "llm_vendors_and_models_model_id_llm_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."llm_models"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" ADD CONSTRAINT "llm_vendors_and_parameters_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" ADD CONSTRAINT "llm_vendors_and_parameters_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" ADD CONSTRAINT "llm_vendors_and_parameter_options_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" ADD CONSTRAINT "llm_vendors_and_parameter_options_parameter_option_id_parameter_options_id_fk" FOREIGN KEY ("parameter_option_id") REFERENCES "public"."parameter_options"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "parameter_options" ("parameter_id", "label", "value")
SELECT DISTINCT
	mp."parameter_id",
	left(val, 100),
	val
FROM "models_and_parameters" mp
CROSS JOIN LATERAL jsonb_array_elements_text(mp."enum") AS val
WHERE mp."enum" IS NOT NULL
	AND jsonb_typeof(mp."enum") = 'array'
	AND val <> '';
--> statement-breakpoint
INSERT INTO "models_and_parameter_options" ("model_id", "parameter_id", "option_id")
SELECT
	mp."model_id",
	mp."parameter_id",
	po."id"
FROM "models_and_parameters" mp
CROSS JOIN LATERAL jsonb_array_elements_text(mp."enum") AS val
INNER JOIN "parameter_options" po
	ON po."parameter_id" = mp."parameter_id"
	AND po."value" = val
WHERE mp."enum" IS NOT NULL
	AND jsonb_typeof(mp."enum") = 'array'
	AND val <> '';
--> statement-breakpoint
ALTER TABLE "models_and_parameters" DROP COLUMN "enum";

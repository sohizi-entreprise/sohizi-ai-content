TRUNCATE TABLE
  "llm_vendors_and_parameter_options",
  "llm_vendors_and_parameters",
  "llm_vendors_and_models",
  "models_and_parameter_options",
  "models_and_parameters",
  "models_and_categories",
  "parameter_options",
  "model_parameters",
  "model_categories",
  "llm_vendors",
  "llm_models"
CASCADE;
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" DROP CONSTRAINT "llm_vendors_and_models_vendor_id_llm_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" DROP CONSTRAINT "llm_vendors_and_parameters_vendor_id_llm_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" DROP CONSTRAINT "llm_vendors_and_parameters_parameter_id_model_parameters_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" DROP CONSTRAINT "llm_vendors_and_parameter_options_vendor_id_llm_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" DROP CONSTRAINT "llm_vendors_and_parameter_options_parameter_option_id_parameter";
--> statement-breakpoint
ALTER TABLE "models_and_categories" DROP CONSTRAINT "models_and_categories_category_id_model_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "models_and_parameters" DROP CONSTRAINT "models_and_parameters_parameter_id_model_parameters_id_fk";
--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" DROP CONSTRAINT "models_and_parameter_options_model_parameter_fk";
--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" DROP CONSTRAINT "models_and_parameter_options_parameter_option_fk";
--> statement-breakpoint
ALTER TABLE "parameter_options" DROP CONSTRAINT "parameter_options_parameter_id_model_parameters_id_fk";
--> statement-breakpoint
CREATE TABLE "llm_vendor_model_parameter_overrides" (
	"vendor_id" varchar(100) NOT NULL,
	"model_id" varchar(50) NOT NULL,
	"parameter_id" varchar(100) NOT NULL,
	"vendor_param_name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "llm_vendor_model_parameter_overrides_vendor_id_model_id_parameter_id_pk" PRIMARY KEY("vendor_id","model_id","parameter_id")
);
--> statement-breakpoint
ALTER TABLE "llm_vendors" ALTER COLUMN "id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "llm_vendors" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" ALTER COLUMN "vendor_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" ALTER COLUMN "vendor_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" ALTER COLUMN "parameter_option_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" ALTER COLUMN "vendor_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" ALTER COLUMN "parameter_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "model_categories" ALTER COLUMN "id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "model_categories" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "model_parameters" ALTER COLUMN "id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "model_parameters" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "models_and_categories" ALTER COLUMN "category_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ALTER COLUMN "parameter_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ALTER COLUMN "option_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "models_and_parameters" ALTER COLUMN "parameter_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "parameter_options" ALTER COLUMN "id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "parameter_options" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "parameter_options" ALTER COLUMN "parameter_id" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "llm_vendors" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_models" ADD CONSTRAINT "llm_vendors_and_models_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" ADD CONSTRAINT "llm_vendors_and_parameters_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameters" ADD CONSTRAINT "llm_vendors_and_parameters_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" ADD CONSTRAINT "llm_vendors_and_parameter_options_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendors_and_parameter_options" ADD CONSTRAINT "llm_vendors_and_parameter_options_parameter_option_id_parameter_options_id_fk" FOREIGN KEY ("parameter_option_id") REFERENCES "public"."parameter_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_and_categories" ADD CONSTRAINT "models_and_categories_category_id_model_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."model_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_and_parameters" ADD CONSTRAINT "models_and_parameters_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ADD CONSTRAINT "models_and_parameter_options_model_parameter_fk" FOREIGN KEY ("model_id","parameter_id") REFERENCES "public"."models_and_parameters"("model_id","parameter_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_and_parameter_options" ADD CONSTRAINT "models_and_parameter_options_parameter_option_fk" FOREIGN KEY ("parameter_id","option_id") REFERENCES "public"."parameter_options"("parameter_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_options" ADD CONSTRAINT "parameter_options_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendor_model_parameter_overrides" ADD CONSTRAINT "llm_vendor_model_parameter_overrides_vendor_id_llm_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."llm_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendor_model_parameter_overrides" ADD CONSTRAINT "llm_vendor_model_parameter_overrides_model_id_llm_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."llm_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_vendor_model_parameter_overrides" ADD CONSTRAINT "llm_vendor_model_parameter_overrides_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "model_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"x_ui_component" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models_and_parameters" (
	"model_id" varchar(50) NOT NULL,
	"parameter_id" uuid NOT NULL,
	"provider_param_name" varchar(100),
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_value" text,
	"constraints" jsonb,
	"enum" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_and_parameters_model_id_parameter_id_pk" PRIMARY KEY("model_id","parameter_id")
);
--> statement-breakpoint
ALTER TABLE "models_and_parameters" ADD CONSTRAINT "models_and_parameters_model_id_llm_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."llm_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_and_parameters" ADD CONSTRAINT "models_and_parameters_parameter_id_model_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."model_parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "model_parameters_key_unique" ON "model_parameters" USING btree ("key");--> statement-breakpoint
DROP TABLE "models_options_and_models" CASCADE;--> statement-breakpoint
DROP TABLE "models_options" CASCADE;

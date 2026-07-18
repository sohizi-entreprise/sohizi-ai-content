ALTER TABLE "user" ADD COLUMN "type" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE TABLE "models_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"options" jsonb NOT NULL,
	"default" varchar(100),
	"active" boolean DEFAULT true NOT NULL,
	"provider" varchar(50) DEFAULT 'generic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models_options_and_models" (
	"option_id" uuid NOT NULL,
	"model_id" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "models_options_and_models" ADD CONSTRAINT "models_options_and_models_option_id_models_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."models_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_options_and_models" ADD CONSTRAINT "models_options_and_models_model_id_llm_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."llm_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "models_options_provider_key_unique" ON "models_options" USING btree ("provider","key");--> statement-breakpoint
CREATE UNIQUE INDEX "models_options_and_models_option_id_model_id_unique" ON "models_options_and_models" USING btree ("option_id","model_id");

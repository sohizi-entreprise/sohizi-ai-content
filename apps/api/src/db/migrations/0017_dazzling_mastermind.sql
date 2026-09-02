CREATE TABLE "model_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models_and_categories" (
	"model_id" varchar(50) NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_and_categories_model_id_category_id_pk" PRIMARY KEY("model_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "models_and_categories" ADD CONSTRAINT "models_and_categories_model_id_llm_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."llm_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models_and_categories" ADD CONSTRAINT "models_and_categories_category_id_model_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."model_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "model_categories_name_unique" ON "model_categories" USING btree ("name");--> statement-breakpoint
ALTER TABLE "llm_models" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "llm_models" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "llm_models" DROP COLUMN "recommended_usage";
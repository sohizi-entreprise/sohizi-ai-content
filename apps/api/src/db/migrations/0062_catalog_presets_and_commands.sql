CREATE TABLE IF NOT EXISTS "presets" (
  "id" varchar(100) PRIMARY KEY NOT NULL,
  "key" varchar(100) NOT NULL,
  "label" varchar(100) NOT NULL,
  "generation_target" varchar(50) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "presets_key_unique" ON "presets" USING btree ("key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preset_options" (
  "id" varchar(100) PRIMARY KEY NOT NULL,
  "preset_id" varchar(100) NOT NULL REFERENCES "public"."presets"("id") ON DELETE cascade ON UPDATE no action,
  "label" varchar(100) NOT NULL,
  "value" text NOT NULL,
  "illustration" jsonb NOT NULL,
  "prompt_modifier" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "preset_options_preset_id_value_unique" ON "preset_options" USING btree ("preset_id","value");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "preset_options_preset_id_sort_order_idx" ON "preset_options" USING btree ("preset_id","sort_order");
--> statement-breakpoint
DROP TABLE IF EXISTS "commands" CASCADE;
--> statement-breakpoint
CREATE TABLE "commands" (
  "id" varchar(100) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "prompt_modifier" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "commands_name_unique" ON "commands" USING btree ("name");

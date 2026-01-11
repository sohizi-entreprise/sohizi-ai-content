CREATE TYPE "public"."audience" AS ENUM('general', 'kids', 'teens', 'adult');--> statement-breakpoint
CREATE TYPE "public"."character_role" AS ENUM('protagonist', 'antagonist', 'supporting', 'narrator', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."project_format" AS ENUM('storytime', 'explainer', 'documentary', 'presenter');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'OUTLINE_GENERATED', 'OUTLINE_CONFIRMED', 'SHOTS_GENERATED');--> statement-breakpoint
CREATE TYPE "public"."shot_angle" AS ENUM('eye_level', 'low', 'high', 'over_shoulder', 'top_down');--> statement-breakpoint
CREATE TYPE "public"."shot_movement" AS ENUM('static', 'slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down');--> statement-breakpoint
CREATE TYPE "public"."shot_type" AS ENUM('establishing', 'wide', 'medium', 'closeup', 'insert');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('dawn', 'day', 'sunset', 'night', 'unspecified');--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"name" text NOT NULL,
	"role" character_role DEFAULT 'unknown',
	"description" text NOT NULL,
	"locked_traits" jsonb,
	"default_costume_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"costume_id" text NOT NULL,
	"character_ref" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"time_of_day_default" time_of_day DEFAULT 'unspecified',
	"lighting" text,
	"palette" jsonb,
	"must_include" jsonb,
	"must_avoid" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outline_acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"act_id" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"goals" jsonb,
	"turning_points" jsonb,
	"scene_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"logline" text NOT NULL,
	"audience" "audience" DEFAULT 'general' NOT NULL,
	"tone" text,
	"genre" text,
	"style_pack_id" text,
	"constraints" jsonb,
	"raw_llm_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"format" "project_format" NOT NULL,
	"status" "project_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "props" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prop_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" text NOT NULL,
	"act_id" text,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"mood" text,
	"time_of_day" time_of_day DEFAULT 'unspecified',
	"location_ref" text,
	"raw_llm_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shot_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shot_db_id" uuid NOT NULL,
	"provider" text DEFAULT 'fal' NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"negative_prompt" text,
	"seed" integer,
	"image_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_db_id" uuid NOT NULL,
	"shot_id" text NOT NULL,
	"order" integer NOT NULL,
	"shot_type" "shot_type" DEFAULT 'medium',
	"angle" "shot_angle" DEFAULT 'eye_level',
	"lens" text,
	"movement" "shot_movement" DEFAULT 'static',
	"visual_summary" text NOT NULL,
	"composition" text,
	"action" text,
	"mood_keywords" jsonb,
	"entities_in_shot" jsonb,
	"spoken" jsonb,
	"constraints" jsonb,
	"raw_llm_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costumes" ADD CONSTRAINT "costumes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outline_acts" ADD CONSTRAINT "outline_acts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "props" ADD CONSTRAINT "props_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_images" ADD CONSTRAINT "shot_images_shot_db_id_shots_id_fk" FOREIGN KEY ("shot_db_id") REFERENCES "public"."shots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_scene_db_id_scenes_id_fk" FOREIGN KEY ("scene_db_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
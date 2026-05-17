CREATE TABLE "asset_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"metadata" jsonb,
	"size" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"blurhash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"source" varchar(50) NOT NULL,
	"generation_request_id" uuid,
	"file_node_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "generation_requests_status_idx";--> statement-breakpoint
ALTER TABLE "generation_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "request" jsonb;--> statement-breakpoint
ALTER TABLE "asset_variants" ADD CONSTRAINT "asset_variants_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_file_node_id_file_nodes_id_fk" FOREIGN KEY ("file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_variants_asset_id_type_unique" ON "asset_variants" USING btree ("asset_id","type");--> statement-breakpoint
CREATE INDEX "assets_project_type_created_at_idx" ON "assets" USING btree ("project_id","type","created_at");--> statement-breakpoint
CREATE INDEX "assets_project_source_created_at_idx" ON "assets" USING btree ("project_id","source","created_at");--> statement-breakpoint
CREATE INDEX "assets_generation_request_id_idx" ON "assets" USING btree ("generation_request_id");--> statement-breakpoint
CREATE INDEX "generation_requests_project_created_at_idx" ON "generation_requests" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_requests_status_created_at_idx" ON "generation_requests" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "generation_requests" DROP COLUMN "metadata";
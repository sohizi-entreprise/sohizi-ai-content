CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."chat_message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"finish_reason" varchar(50) DEFAULT 'not-finished' NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_node_content_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_node_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"search_text" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce("chunk_text", ''))) STORED,
	"embedding" vector,
	"embedding_metadata" jsonb,
	"token_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_node_contents" (
	"file_node_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"content" text,
	"json_content" jsonb,
	"prose_content" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_node_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_node_id" uuid NOT NULL,
	"related_file_node_id" uuid NOT NULL,
	"relation_type" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"directory" boolean DEFAULT false NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"format" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'ENQUEUED' NOT NULL,
	"type" varchar(50) NOT NULL,
	"metadata" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"role" "chat_message_role" NOT NULL,
	"content" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(100) NOT NULL,
	"brief" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_node_contents_project_id_file_node_id_unique" ON "file_node_contents" USING btree ("project_id","file_node_id");--> statement-breakpoint
CREATE INDEX "file_node_contents_project_id_idx" ON "file_node_contents" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_nodes_project_id_id_unique" ON "file_nodes" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_nodes_project_id_parent_id_name_unique" ON "file_nodes" USING btree ("project_id","parent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "file_nodes_project_id_root_name_unique" ON "file_nodes" USING btree ("project_id","name") WHERE "file_nodes"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "file_nodes_project_id_parent_id_position_idx" ON "file_nodes" USING btree ("project_id","parent_id","position");--> statement-breakpoint
ALTER TABLE "file_node_content_chunks" ADD CONSTRAINT "file_node_content_chunks_project_id_file_node_id_file_node_contents_project_id_file_node_id_fk" FOREIGN KEY ("project_id","file_node_id") REFERENCES "public"."file_node_contents"("project_id","file_node_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_node_contents" ADD CONSTRAINT "file_node_contents_project_id_file_node_id_file_nodes_project_id_id_fk" FOREIGN KEY ("project_id","file_node_id") REFERENCES "public"."file_nodes"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_node_relationships" ADD CONSTRAINT "file_node_relationships_file_node_id_file_nodes_id_fk" FOREIGN KEY ("file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_node_relationships" ADD CONSTRAINT "file_node_relationships_related_file_node_id_file_nodes_id_fk" FOREIGN KEY ("related_file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_nodes" ADD CONSTRAINT "file_nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_nodes" ADD CONSTRAINT "file_nodes_project_id_parent_id_file_nodes_project_id_id_fk" FOREIGN KEY ("project_id","parent_id") REFERENCES "public"."file_nodes"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_conversation_id_idx" ON "agent_runs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversations_project_id_idx" ON "conversations" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_node_content_chunks_file_node_id_chunk_index_unique" ON "file_node_content_chunks" USING btree ("file_node_id","chunk_index");--> statement-breakpoint
CREATE INDEX "file_node_content_chunks_project_id_file_node_id_idx" ON "file_node_content_chunks" USING btree ("project_id","file_node_id");--> statement-breakpoint
CREATE INDEX "file_node_content_chunks_search_text_idx" ON "file_node_content_chunks" USING gin ("search_text");--> statement-breakpoint
CREATE UNIQUE INDEX "file_node_relationships_project_id_file_node_id_related_file_node_id_unique" ON "file_node_relationships" USING btree ("project_id","file_node_id","related_file_node_id");--> statement-breakpoint
CREATE INDEX "generation_requests_status_idx" ON "generation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_run_id_idx" ON "messages" USING btree ("run_id");
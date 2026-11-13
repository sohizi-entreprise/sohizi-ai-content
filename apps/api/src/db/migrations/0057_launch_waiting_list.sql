CREATE TABLE "feature_flags" (
  "name" varchar(100) PRIMARY KEY NOT NULL,
  "enable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waiting_list" (
  "email" varchar(320) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "feature_flags" ("name", "enable") VALUES ('ACCEPT_USERS', false);

CREATE TYPE "public"."billing_ledger_kind" AS ENUM('reserve', 'settle_diff', 'refund', 'topup', 'expire', 'overage_uncovered');--> statement-breakpoint
CREATE TYPE "public"."billing_reservation_status" AS ENUM('reserved', 'settled', 'refunded', 'expired');--> statement-breakpoint
CREATE TABLE "billing_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"organization_id" text NOT NULL,
	"delta" bigint NOT NULL,
	"kind" "billing_ledger_kind" NOT NULL,
	"balance_after" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"operation" varchar(100) NOT NULL,
	"estimated_credits" bigint NOT NULL,
	"actual_credits" bigint,
	"status" "billing_reservation_status" DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_wallets" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_ledger" ADD CONSTRAINT "billing_ledger_reservation_id_billing_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."billing_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_ledger" ADD CONSTRAINT "billing_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD CONSTRAINT "billing_reservations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD CONSTRAINT "billing_reservations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD CONSTRAINT "organization_wallets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_ledger_idempotency_key_unique" ON "billing_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_ledger_org_created_at_idx" ON "billing_ledger" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_ledger_reservation_id_idx" ON "billing_ledger" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_reservations_idempotency_key_unique" ON "billing_reservations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_reservations_status_expires_at_idx" ON "billing_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "billing_reservations_org_status_idx" ON "billing_reservations" USING btree ("organization_id","status");
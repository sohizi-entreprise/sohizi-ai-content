ALTER TABLE "billing_ledger" ADD COLUMN "balance_delta" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_ledger" ADD COLUMN "payg_delta" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD COLUMN "balance_reserved" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD COLUMN "payg_reserved" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD COLUMN "balance_generation" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD COLUMN "payg_generation" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "balance_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "balance_generation" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "payg_balance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "payg_balance_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "payg_generation" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing entries all belong to the pre-PAYG balance.
UPDATE "billing_ledger" SET "balance_delta" = "delta";--> statement-breakpoint
UPDATE "billing_reservations" SET "balance_reserved" = "estimated_credits";--> statement-breakpoint
ALTER TABLE "billing_ledger" ADD CONSTRAINT "billing_ledger_source_sum" CHECK ("billing_ledger"."balance_delta" + "billing_ledger"."payg_delta" = "billing_ledger"."delta");--> statement-breakpoint
ALTER TABLE "billing_reservations" ADD CONSTRAINT "billing_reservations_source_sum" CHECK ("billing_reservations"."balance_reserved" + "billing_reservations"."payg_reserved" = "billing_reservations"."estimated_credits");--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD CONSTRAINT "organization_wallets_balance_nonnegative" CHECK ("organization_wallets"."balance" >= 0);--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD CONSTRAINT "organization_wallets_payg_balance_nonnegative" CHECK ("organization_wallets"."payg_balance" >= 0);

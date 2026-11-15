ALTER TABLE "organization_wallets" ADD COLUMN "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "stripe_subscription_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_wallets_stripe_customer_id_unique" ON "organization_wallets" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_wallets_stripe_subscription_id_unique" ON "organization_wallets" USING btree ("stripe_subscription_id");

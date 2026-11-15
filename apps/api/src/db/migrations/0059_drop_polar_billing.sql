DROP TABLE IF EXISTS "polar_processed_orders";
ALTER TABLE "organization_wallets" DROP COLUMN IF EXISTS "polar_customer_id";
ALTER TABLE "organization_wallets" DROP COLUMN IF EXISTS "polar_subscription_id";

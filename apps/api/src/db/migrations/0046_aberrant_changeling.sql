CREATE TABLE "polar_processed_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"credits_granted" bigint NOT NULL,
	"kind" text NOT NULL,
	"refunded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "polar_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "polar_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "product_name" text;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "allowance" bigint;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "status" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD COLUMN "pending_product_id" text;--> statement-breakpoint
ALTER TABLE "polar_processed_orders" ADD CONSTRAINT "polar_processed_orders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_wallets_polar_customer_id_unique" ON "organization_wallets" USING btree ("polar_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_wallets_polar_subscription_id_unique" ON "organization_wallets" USING btree ("polar_subscription_id");
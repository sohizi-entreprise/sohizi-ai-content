# Stripe Managed Payments billing

The customer-facing billing API uses the Stripe SDK. Better Auth continues to handle sign-in and organization membership. The retired sandbox prototype has been removed.

## Configure each environment

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_CREATOR_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_CREDIT_PRICE_ID`, and `STRIPE_PORTAL_CONFIGURATION_ID`. Use the existing sandbox prices for Starter, Creator, Studio, Pro, and credits in sandbox; use the corresponding live IDs in production. Do not mix test and live keys or prices.

Managed Payments accepted unpaid subscription and extra-credit Checkout sessions in both the sandbox and live accounts on 2026-11-15. The five products in both accounts use the eligible `txcd_10105001` tax code, cloud-based AI service for personal use. Every plan product has positive integer `creditAmount` and `planTier` metadata. The one-time credit product has positive integer `minimumUnits`; one price unit buys one credit. The sandbox minimum is 250 credits and the live minimum is 500 credits.

Use the sandbox portal configuration `bpc_1Ubl4uPkk5GV6lkptHeTztu1` or the live configuration `bpc_1UbqoGPWtR47ttOqA31Zw0ld`. Both allow payment-method updates and invoice history and disable plan switching, quantity changes, pausing, and cancellation. To configure this in the Dashboard, open **Settings → Billing → Customer portal**, disable **Switch plan**, **Update quantities**, and **Cancel subscription**, then copy the configuration ID. Link provides separate subscription controls; verify that those cannot violate Sohizi's plan-change rules before launch.

Register `POST /billing/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `charge.refunded`. The endpoint verifies the Stripe signature and checks live/test mode. The daily reconciliation job repairs missed webhook deliveries.

## Outstanding launch checks

- Neither Stripe account currently has a registered webhook endpoint. Register the matching public API endpoint after deployment and store its signing secret in that environment's `API_STRIPE_WEBHOOK_SECRET`. Use a webhook API version compatible with the installed Stripe SDK (`2026-10-28.endive`).
- The live API secret key is not present in `.env.ready.git-prod`; obtain it securely from the live Stripe Dashboard. The RC environment uses the existing sandbox key. Do not use the CLI login token as a server API key.
- Both Stripe accounts are standard Cyprus accounts with charges enabled. Stripe accepted unpaid Managed Payments Checkout sessions for both product types, but paid checkout, webhooks, upgrade and downgrade operations, and Link subscription controls still need end-to-end sandbox testing.
- The Stripe business profiles currently have no support email. The public site publishes `support@sohizi.com`; confirm and set the correct Stripe support address before accepting payments.

## Prelaunch reset

This is only for the current test-user population. Before deploying the new billing routes, back up each database and apply migrations `0058` and `0059`. In _each_ environment, configure its Stripe credentials, then run `RESET_TEST_BILLING=yes` with `apps/api/src/db/scripts/reset-test-billing.ts`. Cancel old test subscriptions in the former provider dashboard and set `LEGACY_SUBSCRIPTIONS_CLEARED=yes` before running the script. The script cancels known Stripe subscriptions, expires outstanding reservations and both credit pools with ledger entries, and clears provider references and paid-plan state. Check every organization has zero included and purchased credits and no active provider subscription. Register the Stripe webhook before accepting payments. Billing is available whenever the Stripe credentials and prices are configured; there is no separate feature flag.

Do not run the reset against real customers. It has not been run by this code change.

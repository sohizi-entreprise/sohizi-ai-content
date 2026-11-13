# Polar billing setup

For product price and credit allowance calculations, see [Polar pricing](./POLAR_PRICING.md).

The app uses Polar as its product catalog and payment system. The Better Auth Polar plugin verifies incoming webhooks at `/api/auth/polar/webhooks`; organization checkout and portal sessions use the Polar SDK because each organization owns one customer.

## Sandbox and production

1. Create an organization access token with organization-read, product, customer, checkout, subscription, order, and customer-session permissions. The API runtime reads `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, and `POLAR_ENVIRONMENT` (`sandbox` locally, `production` for live billing). Production Compose maps its `API_POLAR_*` deployment variables to those runtime names.
2. In each Polar environment, create monthly recurring subscription products and a one-time unit-based top-up product. Set `creditAmount` in each subscription product's metadata to a positive integer; a top-up grants the purchased number of units as credits. Give each monthly plan a positive integer `planTier` (for example, 1 for Starter and 4 for Pro); a higher tier is an immediate upgrade regardless of price or allowance. Top-ups do not need a tier. Set the top-up price per credit and its minimum and maximum units in Polar. Publish only products intended for the app. Prices, currencies, descriptions, and allowances are read from Polar.
3. Register a Polar webhook endpoint at `https://<API_BETTER_AUTH_URL host>/api/auth/polar/webhooks`. Subscribe to `order.paid`, `order.refunded`, and subscription created, updated, active, canceled, uncanceled, past-due, and revoked events. Set that endpoint's signing secret as `POLAR_WEBHOOK_SECRET` in the API runtime.
4. Enable `feature_settings.reset_proration_behavior_enabled` in each Polar environment before offering upgrades. The app verifies the feature flag before an immediate upgrade and sends `reset` explicitly. Disable plan changes in Polar's customer portal settings (`subscription.update_plan`), so plan changes follow the app's immediate upgrade and next-period downgrade rules. Keep payment-method and receipt access available.
5. Run database migrations before enabling billing. Existing purchased balances and their pooled expiry remain in the organization wallet. Each new pack purchase extends the whole purchased-credit pool to 12 months after that purchase. Organizations without a paid Polar subscription remain on Free with their existing one-time welcome grant.

The daily `polar-billing-reconciliation` job repairs missed webhook deliveries. A billing manager can also trigger reconciliation from the billing page after returning from checkout. Credit grants depend on confirmed paid orders, not checkout redirects.

An upgrade charges the full new monthly plan amount through Polar and starts a new billing period. After the paid order arrives, the app adds the full new credit allowance to any remaining included credits and moves their shared expiry to Polar's new period end. A downgrade starts at the next paid period.

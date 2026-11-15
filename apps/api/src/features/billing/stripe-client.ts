import Stripe from "stripe"

export function requireStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !/^(sk|rk)_(test|live)_/.test(key))
    throw new Error("Stripe billing is not configured")
  return new Stripe(key)
}

export const stripePriceIds = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  creator: process.env.STRIPE_CREATOR_PRICE_ID,
  studio: process.env.STRIPE_STUDIO_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  credits: process.env.STRIPE_CREDIT_PRICE_ID,
}

export function configuredPrices() {
  if (Object.values(stripePriceIds).some((id) => !id))
    throw new Error("Stripe product prices are not configured")
  return stripePriceIds as Record<keyof typeof stripePriceIds, string>
}

import { createFileRoute } from '@tanstack/react-router'
import { PricingPage } from '@/features/landing/pages/pricing-page'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      {
        title: 'Pricing — Sohizi Lab',
      },
      {
        name: 'description',
        content:
          'Credit-based plans for Sohizi Lab. Start free with 500 one-time credits, then Creator $29, Studio $79, or Pro $199.',
      },
    ],
  }),
  component: PricingPage,
})

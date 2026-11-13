export const pricingPage = {
  headline: "One studio. Your pace.",
  body: "Every plan gives you the full Sohizi Lab workspace. Choose the monthly credit budget that fits how often you create.",
} as const

export const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    credits: 2200,
    description: "For exploring ideas and creating at your own pace.",
    highlighted: false,
    badge: null,
    ctaLabel: "Choose Starter",
  },
  {
    id: "creator",
    name: "Creator",
    price: 29,
    credits: 3500,
    description: "For turning more ideas into images and short clips.",
    highlighted: false,
    badge: null,
    ctaLabel: "Choose Creator",
  },
  {
    id: "studio",
    name: "Studio",
    price: 49,
    credits: 6200,
    description: "For regular creation across multiple projects.",
    highlighted: true,
    badge: "Recommended",
    ctaLabel: "Choose Studio",
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    credits: 10500,
    description: "For a steady production schedule and more room to iterate.",
    highlighted: false,
    badge: null,
    ctaLabel: "Choose Pro",
  },
] as const

export type PlanId = (typeof plans)[number]["id"]

export const sharedPlanFeatures = [
  "Unlimited projects",
  "Script editor and storyboard",
  "Video timeline and editor, up to 20 minutes",
  "Up to 5 concurrent media generations",
  "AI image, video, voice, and music generation",
  "Context-aware AI assistant",
  "Commercial use",
  "Credit top-ups when you need more",
] as const

export const creditPacks = {
  eyebrow: "Extra credits",
  headline: "Top up only when you need to.",
  body: "Choose how many extra credits to buy. The total updates with your selection.",
  note: "One-time purchase with an active subscription. Purchased credits last 12 months from purchase.",
} as const

export const pricingFaq = {
  headline: "Billing questions.",
  body: "Credits, plans, and how billing works before your first frame.",
  contactLine: "Still unsure which plan fits?",
  contactEmail: "support@sohizi.com",
  items: [
    {
      question: "What are credits?",
      answer:
        "Credits are the shared currency for AI usage across Sohizi Lab. Scripts, images, video, voice, and music draw from the same wallet. The credit cost depends on the model and settings you choose.",
    },
    {
      question: "Do unused credits roll over?",
      answer:
        "Included subscription credits refresh each billing month and do not roll over. Purchased top-up credits last 12 months from purchase.",
    },
    {
      question: "What happens when I run out of credits?",
      answer:
        "Generation that requires credits will pause until you upgrade, wait for your next monthly allotment, or purchase additional credits. Your projects, scripts, and edits stay in your workspace.",
    },
    {
      question: "Can I change or cancel my plan?",
      answer:
        "Yes. You can upgrade, downgrade, or cancel from your account billing settings. Upgrades take effect immediately and start a new billing period; downgrades take effect at the next paid period. Canceling stops future renewals.",
    },
    {
      question: "Can I buy extra credits on top of my plan?",
      answer:
        "Yes. With an active subscription, choose how many extra credits to buy in your account billing page. The price is calculated per credit and shown before checkout. Purchased credits last 12 months from purchase.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "Except where required by law, payments are generally non-refundable once plan time or credits have been consumed. We may refund credits for technical failures at our discretion. Contact support@sohizi.com if something went wrong on our side.",
    },
    {
      question: "Which plan should I pick?",
      answer:
        "Starter fits occasional creation. Creator gives you more room for images and short clips. Studio is our recommended plan for regular work across projects. Pro fits a steady production schedule. Every plan includes the same studio tools; choose by the monthly credit budget you need.",
    },
  ],
} as const

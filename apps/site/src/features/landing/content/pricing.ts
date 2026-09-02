export const pricingPage = {
  headline: "Simple credit-based plans",
  body: "One wallet for scripts, images, video, voice, and music. Start free with one-time credits, then pick a monthly plan when you need more.",
} as const

export const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 500,
    creditCadence: "one-time" as const,
    effectiveRate: "—",
    description:
      "Try the full workspace with a one-time grant of 500 credits — no card required to start.",
    highlighted: false,
    ctaLabel: "Start free",
  },
  {
    id: "creator",
    name: "Creator",
    price: 29,
    credits: 2500,
    creditCadence: "monthly" as const,
    effectiveRate: "$0.0116 / credit",
    description:
      "Light-to-moderate text use, occasional image generation, and short video experiments.",
    highlighted: false,
    ctaLabel: "Start with Creator",
  },
  {
    id: "studio",
    name: "Studio",
    price: 79,
    credits: 8000,
    creditCadence: "monthly" as const,
    effectiveRate: "$0.0099 / credit",
    description:
      "Regular image generation, meaningful text usage, and consistent short-form video.",
    highlighted: true,
    ctaLabel: "Start with Studio",
  },
  {
    id: "pro",
    name: "Pro",
    price: 199,
    credits: 22000,
    creditCadence: "monthly" as const,
    effectiveRate: "$0.0090 / credit",
    description:
      "Heavy weekly usage, frequent media generation, and serious video plus audio work.",
    highlighted: false,
    ctaLabel: "Start with Pro",
  },
] as const

export type PlanId = (typeof plans)[number]["id"]

export type CompareCell = string | boolean

export const comparisonRows: Array<{
  feature: string
  free: CompareCell
  creator: CompareCell
  studio: CompareCell
  pro: CompareCell
}> = [
  {
    feature: "Credits",
    free: "500 (one-time)",
    creator: "2,500 / month",
    studio: "8,000 / month",
    pro: "22,000 / month",
  },
  {
    feature: "Effective rate",
    free: "—",
    creator: "$0.0116 / credit",
    studio: "$0.0099 / credit",
    pro: "$0.0090 / credit",
  },
  {
    feature: "Script & text editor",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "AI image generation",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "AI video generation",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "AI voice & music",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "Storyboard & shot planning",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "Video editor",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "Context-aware AI assistant",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "Included credit rollover",
    free: false,
    creator: false,
    studio: false,
    pro: false,
  },
  {
    feature: "Commercial use",
    free: true,
    creator: true,
    studio: true,
    pro: true,
  },
  {
    feature: "Support",
    free: "Community",
    creator: "Email",
    studio: "Priority email",
    pro: "Priority email",
  },
]

export const pricingFaq = {
  headline: "Billing FAQ",
  body: "Common questions about credits, plans, and how billing works on Sohizi Lab.",
  contactLine: "Still unsure which plan fits?",
  contactEmail: "hello@sohizi.com",
  items: [
    {
      question: "What are credits?",
      answer:
        "Credits are the shared currency for AI usage across Sohizi Lab — scripts, images, video, voice, and music all draw from the same wallet. Roughly, 1 credit ≈ $0.01 of list value. Exact burn depends on the model and modality you use.",
    },
    {
      question: "What’s included in the Free plan?",
      answer:
        "Free gives you a one-time grant of 500 credits to try the full workspace. It does not renew each month. When those credits are gone, you can upgrade to a paid plan or buy top-ups when available.",
    },
    {
      question: "Do unused credits roll over?",
      answer:
        "Included subscription credits refresh each billing month and do not roll over. Free credits are a one-time grant. If we offer top-up packs, those typically last longer than monthly included credits — we’ll show the expiration at purchase.",
    },
    {
      question: "What happens when I run out of credits?",
      answer:
        "Generation that requires credits will pause until you upgrade, wait for your next monthly allotment on a paid plan, or purchase additional credits. Your projects, scripts, and edits stay in your workspace.",
    },
    {
      question: "Can I change or cancel my plan?",
      answer:
        "Yes. You can upgrade, downgrade, or cancel from your account billing settings. Changes typically take effect at the next billing cycle unless we apply an upgrade immediately. Canceling stops future renewals; you keep access through the period you’ve already paid for.",
    },
    {
      question: "Can I buy extra credits on top of my plan?",
      answer:
        "Top-up packs are designed for bursts beyond your monthly allotment. They’re usually priced above the effective rate of subscription-included credits. Availability and pack sizes may expand over time.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "Except where required by law, payments are generally non-refundable once plan time or credits have been consumed. We may refund credits for technical failures at our discretion. Contact hello@sohizi.com if something went wrong on our side.",
    },
    {
      question: "Which plan should I pick?",
      answer:
        "Start Free to learn the workflow. Creator fits light monthly use and short experiments. Studio is the recommended plan for regular image and short-form video work. Pro is for heavy weekly generation across video and audio.",
    },
  ],
} as const

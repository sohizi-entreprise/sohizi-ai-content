export const CTA_LABEL = "Start creating free"

export const navLinks = [
  { label: "Showcase", href: "/#showcase" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
] as const

export const socialLinks = [
  { label: "YouTube", href: "#", network: "youtube" },
  { label: "LinkedIn", href: "#", network: "linkedin" },
  { label: "Discord", href: "#", network: "discord" },
  { label: "Instagram", href: "#", network: "instagram" },
] as const

export const hero = {
  brand: "Sohizi Lab",
  eyebrow: "The AI video workspace",
  headline: "Make your whole AI video in one tool. Not eight.",
  subheadline:
    "Write scripts, generate media, storyboard, and edit video in one AI-assisted workspace that knows the full context of your project.",
} as const

export const problem = {
  headline: "One video. Eight tools. Zero memory.",
  body: "Script in one app. Images in another. Clips, voice, music, and the edit each in their own. Every jump means exporting, re-uploading, and re-explaining the same character and style — because nothing remembers what came before.",
  punchline:
    "The hard part was never the creativity. It's the commute between tools.",
} as const

export const compareRows = [
  {
    category: "Approach",
    sohizi: "Design, generation, and edit in sync",
    traditional: "Disconnected apps per stage",
  },
  {
    category: "Process",
    sohizi: "One project, transparent from start to cut",
    traditional: "Endless exports and vague handoffs",
  },
  {
    category: "Context",
    sohizi: "AI that remembers the whole project",
    traditional: "Re-explain characters and style every time",
  },
  {
    category: "Consistency",
    sohizi: "Style holds from first scene to final cut",
    traditional: "Prompt babysitting across tools",
  },
  {
    category: "Cost",
    sohizi: "One subscription for the full workflow",
    traditional: "A stack of separate subscriptions",
  },
  {
    category: "Handoffs",
    sohizi: "Assets stay tied to their scenes",
    traditional: "Re-upload, reorganize, restart",
  },
] as const

export const showcase = {
  id: "showcase",
  headline: "Don't take our word for it. Watch the output.",
  body: "Every video below was written, generated, storyboarded, and edited inside a single Sohizi project. No stitching together six tools. One workspace, start to finish.",
  caption:
    "Cinematic stories, ads, shorts, explainers, music videos — all made the same way.",
  items: [
    {
      id: "product-ad",
      label: "30s product ad",
      title: "Launch cut",
      poster: "/imgPlaceholder.jpeg",
      videoUrl: null as string | null,
      span: "lg:col-span-2 lg:row-span-2",
    },
    {
      id: "short-film",
      label: "Short film",
      title: "Night drive",
      poster: "/imgPlaceholder.jpeg",
      videoUrl: null as string | null,
      span: "lg:col-span-1 lg:row-span-1",
    },
    {
      id: "explainer",
      label: "Explainer",
      title: "How it works",
      poster: "/imgPlaceholder.jpeg",
      videoUrl: null as string | null,
      span: "lg:col-span-1 lg:row-span-1",
    },
    {
      id: "music-video",
      label: "Music video",
      title: "Neon chorus",
      poster: "/imgPlaceholder.jpeg",
      videoUrl: null as string | null,
      span: "lg:col-span-1 lg:row-span-1",
    },
    {
      id: "social-short",
      label: "Social short",
      title: "Hook in 15s",
      poster: "/imgPlaceholder.jpeg",
      videoUrl: null as string | null,
      span: "lg:col-span-2 lg:row-span-1",
    },
    {
      id: "brand-film",
      label: "Brand film",
      title: "Origin story",
      poster: "/imgPlaceholder.jpeg",
      videoUrl: null as string | null,
      span: "lg:col-span-1 lg:row-span-1",
    },
  ],
} as const

export const capabilityHub = {
  hubLabel: "Sohizi Lab",
  capabilities: [
    { id: "text-editor", label: "Text Editor", color: "#2dd4bf" },
    { id: "storyboard", label: "Storyboard", color: "#4ade80" },
    { id: "image-gen", label: "Image Gen", color: "#a3e635" },
    { id: "video-gen", label: "Video Gen", color: "#38bdf8" },
    { id: "video-editor", label: "Video Editor", color: "#fbbf24" },
    { id: "speech", label: "Speech", color: "#fb923c" },
    { id: "music", label: "Music", color: "#f472b6" },
    { id: "ai-assistant", label: "AI Assistant", color: "#67e8f9" },
  ],
} as const

export const solution = {
  headline: "All in one tool",
  words: ["Video Editor", "Media Generator", "Storyboard", "Text editor"],
  paragraphs: [
    "Sohizi Lab brings writing scripts, generating images, video, voice, and music, storyboarding, and video editing into one connected project — guided by an AI assistant that understands the whole thing.",
  ],
  benefits: [
    {
      title: "One subscription, not a stack of them.",
      description:
        "Stop paying separately for a writer, an image tool, a video generator, a voice app, a music service, and an editor — the whole workflow lives here.",
    },
    {
      title: "You don't need to be a specialist at every stage.",
      description:
        "Not a strong writer? Not a video editor? The AI assistant helps you through scripting, generating, storyboarding, and editing so the output stays sharp even where you're less experienced.",
    },
    {
      title: "Consistency without babysitting every prompt.",
      description:
        "Because the AI knows the full project, your characters, style, and story hold together from the first scene to the final cut.",
    },
    {
      title: "Your idea stays warm.",
      description:
        "No more losing the afternoon to exports, re-uploads, and tool-hopping before you get back to creating.",
    },
    {
      title: "Consistency without babysitting every prompt.",
      description:
        "Because the AI knows the full project, your characters, style, and story hold together from the first scene to the final cut.",
    },
  ],
} as const

export const features = {
  headline: "Packed with multiple features",
  subheadline: "To help you build faster and better",
  items: [
    {
      title: "Built for developers",
      description:
        "Built for engineers, developers, dreamers, thinkers and doers.",
    },
    {
      title: "Ease of use",
      description:
        "It's as easy as using an Apple, and as expensive as buying one.",
    },
    {
      title: "Pricing like no other",
      description:
        "Our prices are best in the market. No cap, no lock, no credit card required.",
    },
    {
      title: "100% Uptime guarantee",
      description: "We just cannot be taken down by anyone.",
    },
    {
      title: "Multi-tenant Architecture",
      description: "You can simply share passwords instead of buying new seats",
    },
    {
      title: "24/7 Customer Support",
      description:
        "We are available a 100% of the time. Atleast our AI Agents are.",
    },
    {
      title: "Money back guarantee",
      description:
        "If you donot like EveryAI, we will convince you to like us.",
    },
    {
      title: "And everything else",
      description: "I just ran out of copy ideas. Accept my sincere apologies",
    },
  ],
} as const

export const howItWorks = {
  id: "how-it-works",
  headline: "Check out how it works",
  body: "See how Sohizi works in action. From writing a script to editing the final cut, everything is done in one place.",
  /** YouTube video ID from the watch URL (`v=` param) */
  youtubeId: "YapL3PZxxvI",
  youtubeTitle: "See how Sohizi works",
  steps: [
    {
      title: "Write",
      description:
        "Turn an idea into a script with an AI that helps you shape structure, scenes, and dialogue — not just autocomplete a line.",
    },
    {
      title: "Plan",
      description:
        "Break the script into scenes and shots, build your storyboard, and keep characters and style consistent across the whole thing.",
    },
    {
      title: "Generate",
      description:
        "Create the images, video, voice, and music for each scene right inside the project. Everything lands where it belongs.",
    },
    {
      title: "Edit",
      description:
        "Assemble it on the timeline and refine the final cut — in the same place you started. No handoff, no re-import.",
    },
  ],
} as const

export const audience = {
  headline:
    "If your video still lives across a pile of tools, this is for you.",
  segments: [
    {
      title: "AI filmmakers and short-form creators",
      description:
        "You want the story, the shots, and the cut in one project, not six exports.",
    },
    {
      title: "Marketers and brand teams",
      description:
        "You need product and campaign videos without a toolchain tax on every brief.",
    },
    {
      title: "Agencies and educators",
      description:
        "You ship volume, and you can't afford to rebuild context on every handoff.",
    },
  ],
} as const

export const faq = {
  id: "faq",
  headline: "Frequently Asked Questions",
  contactLine: "Have more questions? Reach out at",
  contactEmail: "hello@sohizi.com",
  ctaCard: {
    title: "Ready to make your next video in one workspace?",
    body: "Start free, open a project, and see the full workflow — script to final cut — without hopping tools.",
  },
  items: [
    {
      question: "Do I have to give up the tools I already use?",
      answer:
        "No. Sohizi Lab covers writing, generation, organization, and editing in one place, but you can still bring in work from elsewhere. The point is that your project stops scattering — not that you throw everything out on day one.",
    },
    {
      question: "Is my work locked into Sohizi?",
      answer:
        "Your work is yours. You can export your final videos and assets. Sohizi keeps them connected while you create; it doesn't hold them hostage.",
    },
    {
      question: "Will this take forever to learn?",
      answer:
        "If you've used a document editor and a video editor, you already know the shape of it — files, folders, tabs, a timeline. The AI handles the parts that usually slow you down.",
    },
    {
      question: "Who owns what I create?",
      answer:
        "You do. Everything you write, generate, and edit in Sohizi Lab belongs to you.",
    },
    {
      question: "What's included right now?",
      answer:
        "The full end-to-end workflow for individual creators: script and text editing, AI image, video, voice, and music generation, storyboarding, scene and asset organization, video editing, and the context-aware AI assistant. Team collaboration is coming later.",
    },
    {
      question: "How much does it cost to start?",
      answer:
        "You get free credit to start. Create your first project and see the workflow before you decide anything.",
    },
  ],
} as const

export const finalCta = {
  headline: "Stop managing tools. Start making videos.",
  body: "Your next project doesn't have to live in eight places at once. Write it, generate it, and cut it in one workspace — with an AI that remembers everything you've made.",
} as const

export const footer = {
  tagline:
    "The AI-native video workspace — write, generate, storyboard, and edit in one project.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Showcase", href: "/#showcase" },
        { label: "How it works", href: "/#how-it-works" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "/#faq" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "Sign in", href: "/sign-in" },
        { label: "Create account", href: "/sign-up" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ],
} as const

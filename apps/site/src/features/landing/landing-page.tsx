import { MarketingShell } from "./marketing-shell"
import { HeroSection } from "./sections/hero"
import { StorySections } from "./sections/story"
import { FaqSection } from "./sections/faq"
import { FinalCtaSection } from "./sections/final-cta"

export function LandingPage() {
  return (
    <MarketingShell ambient={false}>
      <HeroSection />
      <StorySections />
      <FaqSection />
      <FinalCtaSection />
    </MarketingShell>
  )
}

import { MarketingShell } from './marketing-shell'
import { HeroSection } from './sections/hero'
import { ProblemCompareSection } from './sections/problem-compare'
import { ShowcaseSection } from './sections/showcase'
import { SolutionBentoSection } from './sections/solution-bento'
import { HowItWorksSection } from './sections/how-it-works'
import { AudienceSection } from './sections/audience'
import { FaqSection } from './sections/faq'
import { FinalCtaSection } from './sections/final-cta'
import { FeaturesSection } from './sections/features'

export function LandingPage() {
  return (
    <MarketingShell>
      <HeroSection />
      <ProblemCompareSection />
      <SolutionBentoSection />
      <ShowcaseSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AudienceSection />
      <FaqSection />
      <FinalCtaSection />
    </MarketingShell>
  )
}

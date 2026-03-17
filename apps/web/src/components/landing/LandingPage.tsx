import { ContentColumns } from './ContentColumns'
import { LandingNav } from './LandingNav'
import { LandingHero } from './LandingHero'
import { LandingFeatures } from './LandingFeatures'
import { LandingFAQ } from './LandingFAQ'
import { LandingCTABanner } from './LandingCTABanner'
import { LandingFooter } from './LandingFooter'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-[family-name:var(--font-jakarta)]">
      <LandingNav />
      <ContentColumns>
        <LandingHero />
        <LandingFeatures />
        <LandingFAQ />
        <LandingCTABanner />
      </ContentColumns>
      <LandingFooter />
    </div>
  )
}

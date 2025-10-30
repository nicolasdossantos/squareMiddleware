import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import DemoCarousel from '@/components/DemoCarousel'
import FeatureHighlights from '@/components/FeatureHighlights'
import CTABanner from '@/components/CTABanner'
import Footer from '@/components/Footer'

interface LandingPageProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function LandingPage({ theme, onToggleTheme }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary transition-colors duration-300">
      <Header theme={theme} onToggleTheme={onToggleTheme} />
      <main>
        <HeroSection theme={theme} />
        <DemoCarousel />
        <FeatureHighlights />
        <CTABanner />
      </main>
      <Footer theme={theme} />
    </div>
  )
}

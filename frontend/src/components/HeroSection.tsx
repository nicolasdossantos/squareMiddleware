import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import AIBotIllustration from './AIBotIllustration'

interface HeroSectionProps {
  theme: 'light' | 'dark'
}

export default function HeroSection({ theme }: HeroSectionProps) {
  const [isVideoOpen, setIsVideoOpen] = useState(false)

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-light-bg dark:bg-dark-bg" />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-gradient-to-br from-primary-light/10 to-transparent rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-gradient-to-tr from-accent-blue/10 to-transparent rounded-full blur-3xl opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center gap-12">
          {/* Mobile: Floating logo comes first */}
          <div className="lg:hidden h-64">
            <AIBotIllustration theme={theme} />
          </div>

          {/* Left column - Text (centered on mobile, left-aligned on desktop) */}
          <div className="space-y-8 animate-fade-in text-center lg:text-left">
            {/* Logo/Brand mark with text - hidden on mobile */}
            <div className="hidden lg:flex items-center gap-3 justify-start">
              <img
                src={theme === 'light' ? '/lightmodelogo.png' : '/darkmodelogo.png'}
                alt="Fluent Front AI"
                className="w-12 h-12 object-contain flex-shrink-0"
              />
              <span className="text-lg font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                Fluent Front AI
              </span>
            </div>

            {/* Mobile: Just "Fluent Front AI" text, larger and centered */}
            <div className="lg:hidden">
              <h2 className="text-3xl font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                Fluent Front AI
              </h2>
            </div>

            {/* Main headline */}
            <h1 className="heading-1 text-light-text-primary dark:text-dark-text-primary">
              Your Front Desk,
              <br />
              <span className="gradient-text">Fluent in Every Language</span>
            </h1>

            {/* Body copy */}
            <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
              Our agent answers calls, schedules appointments, handles customer questions, and remembers
              preferences—so your team can stay focused on clients.
            </p>

            <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary leading-relaxed font-semibold">
              No "press 1 to continue." Just a real conversation.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center lg:justify-start">
              <Link to="/signup" className="btn-primary flex items-center justify-center gap-2">
                Get Started
              </Link>
              <button
                onClick={() => setIsVideoOpen(true)}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Watch Demo
              </button>
            </div>
          </div>

          {/* Right column - AI Bot illustration (desktop only) */}
          <div className="hidden lg:flex items-center justify-center h-96 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            <AIBotIllustration theme={theme} />
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl bg-light-surface dark:bg-dark-surface rounded-card overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-light-bg dark:bg-dark-bg rounded-lg hover:bg-light-border dark:hover:bg-dark-border transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Video placeholder */}
            <div className="aspect-video bg-light-bg dark:bg-dark-bg flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow-hover">
                  <Play className="w-8 h-8 text-white fill-white" />
                </div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Demo video placeholder
                </p>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                  Connect to your video provider here
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

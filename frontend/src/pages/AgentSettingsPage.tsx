import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Zap, Volume2, Music, ArrowLeft, ArrowRight } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface AgentSettings {
  language: string
  personality: number // 0-4: Very Formal, Formal, Balanced, Casual, Very Casual
  speakingSpeed: number // 0.5-2
  backgroundAmbience: boolean
  ambienceVolume: number // 0-1
}

interface AgentSettingsPageProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const languages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Mandarin Chinese',
  'Japanese',
  'Korean',
]

const personalityLevels = [
  { value: 0, label: 'Very Formal' },
  { value: 1, label: 'Formal' },
  { value: 2, label: 'Balanced' },
  { value: 3, label: 'Casual' },
  { value: 4, label: 'Very Casual' },
]

export default function AgentSettingsPage({ theme, onToggleTheme }: AgentSettingsPageProps) {
  const navigate = useNavigate()

  const [settings, setSettings] = useState<AgentSettings>({
    language: 'English',
    personality: 2, // Balanced by default
    speakingSpeed: 1,
    backgroundAmbience: false,
    ambienceVolume: 0.5,
  })

  const [isLoadingForm, setIsLoadingForm] = useState(false)

  const handleSliderChange = (key: keyof AgentSettings, value: number) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoadingForm(true)

    setTimeout(() => {
      setIsLoadingForm(false)
      // Navigate to next onboarding page (Square OAuth or Phone Number)
      navigate('/square-oauth')
    }, 1500)
  }

  const handleBack = () => {
    navigate('/voice-preferences')
  }

  const currentPersonality = personalityLevels[settings.personality]

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary transition-colors duration-300">
      <Header theme={theme} onToggleTheme={onToggleTheme} />

      <main className="flex-1">
        <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-light-bg dark:bg-dark-bg" />

          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary-light/20 to-transparent rounded-full blur-3xl opacity-50 animate-glow-pulse" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-accent-blue/20 to-transparent rounded-full blur-3xl opacity-40 animate-glow-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-primary-light/10 to-transparent rounded-full blur-3xl opacity-30" />
          </div>

          <div className="relative z-10 w-full max-w-4xl">
            <div className="space-y-8 animate-fade-in">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-light/20 text-primary-light font-semibold">
                    3
                  </div>
                  <h1 className="heading-2 text-left">Agent Settings</h1>
                </div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Configure how your AI receptionist communicates
                </p>
              </div>

              {/* Form Card */}
              <div className="card space-y-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Default Language */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Default Language *</label>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                      The default language used by the agent when answering calls
                    </p>
                    <select
                      value={settings.language}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          language: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 rounded-button border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-primary-light dark:focus:border-primary-dark transition-colors"
                    >
                      {languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Personality Slider */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-primary-light" />
                      <div className="flex-1">
                        <label className="block text-sm font-medium">Personality</label>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          Control how formal or casual your agent sounds
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="range"
                        min="0"
                        max="4"
                        step="1"
                        value={settings.personality}
                        onChange={(e) => handleSliderChange('personality', parseInt(e.target.value))}
                        className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full appearance-none cursor-pointer accent-primary-light"
                      />
                      <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <span>Very Formal</span>
                        <span className="font-semibold text-primary-light">{currentPersonality.label}</span>
                        <span>Very Casual</span>
                      </div>
                    </div>
                  </div>

                  {/* Speaking Speed Slider */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary-light" />
                      <div className="flex-1">
                        <label className="block text-sm font-medium">Speaking Speed</label>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          Adjust how fast or slow the AI speaks
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={settings.speakingSpeed}
                        onChange={(e) => handleSliderChange('speakingSpeed', parseFloat(e.target.value))}
                        className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full appearance-none cursor-pointer accent-primary-light"
                      />
                      <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <span>Slower (0.5x)</span>
                        <span className="font-semibold text-primary-light">{settings.speakingSpeed.toFixed(1)}x</span>
                        <span>Faster (2.0x)</span>
                      </div>
                    </div>
                  </div>

                  {/* Background Ambience */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Music className="w-5 h-5 text-primary-light" />
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <span className="text-sm font-medium">Background Ambience</span>
                        <div
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              backgroundAmbience: !prev.backgroundAmbience,
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.backgroundAmbience
                              ? 'bg-primary-light dark:bg-primary-dark'
                              : 'bg-light-border dark:bg-dark-border'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              settings.backgroundAmbience ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </div>
                      </label>
                    </div>

                    {settings.backgroundAmbience && (
                      <div className="space-y-3 pl-7 border-l-2 border-light-border dark:border-dark-border">
                        <label className="block text-sm font-medium">Ambience Volume</label>
                        <div className="space-y-3">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={settings.ambienceVolume}
                            onChange={(e) => handleSliderChange('ambienceVolume', parseFloat(e.target.value))}
                            className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full appearance-none cursor-pointer accent-primary-light"
                          />
                          <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            <span>Mute</span>
                            <span className="font-semibold text-primary-light">{Math.round(settings.ambienceVolume * 100)}%</span>
                            <span>Full</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 btn-secondary flex items-center justify-center gap-2 group"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      Back to Voice
                    </button>
                    <button
                      type="submit"
                      disabled={isLoadingForm}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isLoadingForm ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer theme={theme} />
    </div>
  )
}

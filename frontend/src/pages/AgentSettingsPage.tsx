import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Zap, Music, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchOnboardingStatus, OnboardingStatus, saveVoicePreferences } from '@/utils/apiClient';
import { useAuth } from '@/context/AuthContext';

interface AgentSettings {
  language: string;
  personality: number; // 0-4: Very Formal, Formal, Balanced, Casual, Very Casual
  speakingSpeed: number; // 0.5-2
  backgroundAmbience: boolean;
  ambienceVolume: number; // 0-1
}

interface AgentSettingsPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
  'Korean'
];

const personalityLevels = [
  { value: 0, label: 'Very Formal' },
  { value: 1, label: 'Formal' },
  { value: 2, label: 'Balanced' },
  { value: 3, label: 'Casual' },
  { value: 4, label: 'Very Casual' }
];

export default function AgentSettingsPage({ theme, onToggleTheme }: AgentSettingsPageProps) {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [voiceProfile, setVoiceProfile] = useState<OnboardingStatus['voiceProfile'] | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const personalityTemperatureMap = useMemo(() => [0.85, 0.95, 1.05, 1.15, 1.25], []);
  const mapTemperatureToPersonality = useCallback(
    (temperature?: number | null) => {
      if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
        return 2;
      }

      let closestIndex = 2;
      let smallestDiff = Number.POSITIVE_INFINITY;

      personalityTemperatureMap.forEach((value, index) => {
        const diff = Math.abs(value - temperature);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestIndex = index;
        }
      });

      return closestIndex;
    },
    [personalityTemperatureMap]
  );
  const temperatureFromPersonality = useCallback(
    (level: number) => {
      const index = Math.min(Math.max(level, 0), personalityTemperatureMap.length - 1);
      return personalityTemperatureMap[index];
    },
    [personalityTemperatureMap]
  );

  const [settings, setSettings] = useState<AgentSettings>({
    language: 'English',
    personality: 2, // Balanced by default
    speakingSpeed: 1,
    backgroundAmbience: false,
    ambienceVolume: 0.5
  });

  const [isLoadingForm, setIsLoadingForm] = useState(false);
  useEffect(() => {
    if (!authState?.tokens?.accessToken) {
      navigate('/signup', { replace: true });
      return;
    }

    let mounted = true;

    const loadStatus = async () => {
      setIsLoadingProfile(true);
      setErrorMessage(null);

      try {
        const response = await fetchOnboardingStatus();
        if (!mounted) return;

        const profile = response.status.voiceProfile;
        setVoiceProfile(profile);

        if (profile) {
          setSettings(prev => ({
            ...prev,
            language: profile.language || prev.language,
            personality: mapTemperatureToPersonality(profile.temperature),
            speakingSpeed: profile.speakingRate ?? prev.speakingSpeed,
            backgroundAmbience:
              !!profile.ambience && profile.ambience !== 'no_background' && profile.ambience !== 'none'
          }));
        }
      } catch (error) {
        if (mounted) {
          console.error('Failed to load onboarding status:', error);
          setErrorMessage('Unable to load your agent settings. Please try again.');
        }
      } finally {
        if (mounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadStatus();

    return () => {
      mounted = false;
    };
  }, [authState, mapTemperatureToPersonality, navigate]);

  const handleSliderChange = (key: keyof AgentSettings, value: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!voiceProfile) {
      setErrorMessage('Please choose a voice before configuring agent settings.');
      return;
    }

    setIsLoadingForm(true);
    setErrorMessage(null);

    try {
      await saveVoicePreferences({
        voiceKey: voiceProfile.voiceKey,
        voiceName: voiceProfile.name,
        voiceProvider: voiceProfile.provider,
        language: settings.language,
        temperature: temperatureFromPersonality(settings.personality),
        speakingRate: Number(settings.speakingSpeed.toFixed(2)),
        ambience: settings.backgroundAmbience ? 'professional_office' : 'no_background'
      });

      navigate('/square-oauth');
    } catch (error) {
      const message =
        (error as any)?.data?.message ||
        (error as Error).message ||
        'Failed to save agent settings. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleBack = () => {
    navigate('/voice-preferences');
  };

  const currentPersonality = personalityLevels[settings.personality];

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
            <div
              className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-accent-blue/20 to-transparent rounded-full blur-3xl opacity-40 animate-glow-pulse"
              style={{ animationDelay: '1s' }}
            />
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
                  {errorMessage && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {isLoadingProfile && (
                    <div className="rounded-lg border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text-secondary dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary">
                      Loading your saved preferences...
                    </div>
                  )}

                  {/* Default Language */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Default Language *</label>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                      The default language used by the agent when answering calls
                    </p>
                    <select
                      value={settings.language}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          language: e.target.value
                        }))
                      }
                      disabled={isLoadingProfile || isLoadingForm}
                      className="w-full px-4 py-2 rounded-button border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-primary-light dark:focus:border-primary-dark transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {languages.map(lang => (
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
                        onChange={e => handleSliderChange('personality', parseInt(e.target.value))}
                        disabled={isLoadingProfile || isLoadingForm}
                        className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full appearance-none cursor-pointer accent-primary-light disabled:cursor-not-allowed"
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
                        onChange={e => handleSliderChange('speakingSpeed', parseFloat(e.target.value))}
                        disabled={isLoadingProfile || isLoadingForm}
                        className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full appearance-none cursor-pointer accent-primary-light disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <span>Slower (0.5x)</span>
                        <span className="font-semibold text-primary-light">
                          {settings.speakingSpeed.toFixed(1)}x
                        </span>
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
                          onClick={() => {
                            if (isLoadingProfile || isLoadingForm) return;
                            setSettings(prev => ({
                              ...prev,
                              backgroundAmbience: !prev.backgroundAmbience
                            }));
                          }}
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
                            onChange={e => handleSliderChange('ambienceVolume', parseFloat(e.target.value))}
                            disabled={isLoadingProfile || isLoadingForm}
                            className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full appearance-none cursor-pointer accent-primary-light disabled:cursor-not-allowed"
                          />
                          <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            <span>Mute</span>
                            <span className="font-semibold text-primary-light">
                              {Math.round(settings.ambienceVolume * 100)}%
                            </span>
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
                      disabled={isLoadingForm || isLoadingProfile}
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
  );
}

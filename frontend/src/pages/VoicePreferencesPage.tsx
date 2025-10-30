import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, ArrowLeft, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchVoices, saveVoicePreferences, VoiceOption } from '@/utils/apiClient';
import { useAuth } from '@/context/AuthContext';

interface VoicePreferencesPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const SIGNUP_CONTEXT_KEY = 'fluentfront.onboarding.signup';
const VOICE_SELECTION_KEY = 'fluentfront.onboarding.voice';

export default function VoicePreferencesPage({ theme, onToggleTheme }: VoicePreferencesPageProps) {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { authState } = useAuth();

  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [isPlayingPreview, setIsPlayingPreview] = useState<string | null>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedVoiceOption = useMemo(
    () => voiceOptions.find(voice => voice.id === selectedVoice),
    [voiceOptions, selectedVoice]
  );

  const signupContext = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(SIGNUP_CONTEXT_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, []);

  // Fetch available voices from backend
  useEffect(() => {
    if (!authState?.tokens?.accessToken) {
      navigate('/signup', { replace: true });
      return;
    }

    let mounted = true;

    const loadVoices = async () => {
      setIsLoadingVoices(true);
      setErrorMessage(null);

      try {
        const response = await fetchVoices();
        if (!mounted) return;

        if (response.success && response.voices) {
          setVoiceOptions(response.voices);

          const storedVoice =
            typeof window !== 'undefined' ? window.sessionStorage.getItem(VOICE_SELECTION_KEY) : null;

          if (storedVoice && response.voices.some(voice => voice.id === storedVoice)) {
            setSelectedVoice(storedVoice);
          } else if (response.voices.length > 0) {
            setSelectedVoice(response.voices[0].id);
          }
        } else {
          setErrorMessage('Unable to load voice options. Please try again shortly.');
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
        if (mounted) {
          setErrorMessage('Failed to load voice options. Please refresh and try again.');
        }
      } finally {
        if (mounted) {
          setIsLoadingVoices(false);
        }
      }
    };

    loadVoices();

    return () => {
      mounted = false;
    };
  }, [authState, navigate]);

  const playPreview = async (voiceId: string) => {
    setIsPlayingPreview(voiceId);

    try {
      // Fetch audio preview from backend
      const response = await fetch(`/api/onboarding/voices/${voiceId}/preview`);

      if (!response.ok) {
        console.error('Failed to fetch voice preview:', response.status, response.statusText);
        setErrorMessage('Unable to load voice preview. Please try another option.');
        setIsPlayingPreview(null);
        return;
      }

      // Convert response to blob and create audio URL
      const audioBlob = await response.blob();
      console.log('Audio blob received:', audioBlob.type, audioBlob.size, 'bytes');

      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;

        // Fallback timeout in case onended doesn't fire
        const timeout = setTimeout(() => {
          console.log('Audio timeout reached');
          setIsPlayingPreview(null);
          URL.revokeObjectURL(audioUrl);
        }, 10000); // 10 second max playback

        // Stop playing indicator when audio ends
        audioRef.current.onended = () => {
          console.log('Audio ended');
          clearTimeout(timeout);
          setIsPlayingPreview(null);
          URL.revokeObjectURL(audioUrl);
        };

        // Play audio and handle errors
        try {
          await audioRef.current.play();
          console.log('Audio playback started for:', voiceId);
        } catch (playError) {
          console.error('Failed to play audio:', playError);
          clearTimeout(timeout);
          setIsPlayingPreview(null);
          URL.revokeObjectURL(audioUrl);
        }
      }
    } catch (error) {
      console.error('Failed to fetch voice preview:', error);
      setIsPlayingPreview(null);
      setErrorMessage('Unable to load voice preview. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoice || !selectedVoiceOption) {
      setErrorMessage('Please select a voice before continuing.');
      return;
    }

    setIsLoadingForm(true);
    setErrorMessage(null);

    try {
      const businessName =
        (signupContext?.businessName as string | undefined) || authState?.tenant?.businessName;
      const timezone =
        (signupContext?.timezone as string | undefined) || authState?.tenant?.timezone || undefined;
      const industry = signupContext?.industry as string | undefined;

      await saveVoicePreferences({
        voiceKey: selectedVoiceOption.id,
        voiceName: selectedVoiceOption.name,
        voiceProvider: selectedVoiceOption.provider,
        language: selectedVoiceOption.language,
        businessName,
        timezone,
        industry
      });

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(VOICE_SELECTION_KEY, selectedVoiceOption.id);
      }

      navigate('/agent-settings');
    } catch (error) {
      const message =
        (error as any)?.data?.message ||
        (error as Error).message ||
        'Failed to save voice preferences. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleBack = () => {
    navigate('/signup');
  };

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
                    2
                  </div>
                  <h1 className="heading-2 text-left">Select Your Voice</h1>
                </div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Pick your preferred AI receptionist voice
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

                  {/* Voice Selection Grid */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-primary-light" />
                      <label className="block text-sm font-medium">Choose a Voice *</label>
                    </div>
                    {isLoadingVoices ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[...Array(10)].map((_, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-card bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border animate-pulse"
                          >
                            <div className="h-4 bg-light-border dark:bg-dark-border rounded w-1/2 mb-3" />
                            <div className="h-3 bg-light-border dark:bg-dark-border rounded w-2/3" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {voiceOptions.map(voice => {
                          return (
                            <div
                              key={voice.id}
                              onClick={() => setSelectedVoice(voice.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedVoice(voice.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className={`p-4 rounded-card border-2 transition-all duration-300 text-center group cursor-pointer ${
                                selectedVoice === voice.id
                                  ? 'border-primary-light dark:border-primary-dark bg-light-surface dark:bg-dark-surface shadow-glow-primary'
                                  : 'border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg hover:border-primary-light dark:hover:border-primary-dark'
                              }`}
                            >
                              <div className="space-y-3">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                      {voice.name}
                                    </h4>
                                    {selectedVoice === voice.id && (
                                      <CheckCircle className="w-4 h-4 text-primary-light" />
                                    )}
                                  </div>
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {voice.gender.charAt(0).toUpperCase() + voice.gender.slice(1)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    playPreview(voice.id);
                                  }}
                                  className="w-full px-3 py-2 sm:px-2 sm:py-1 rounded-button text-sm sm:text-xs font-medium bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border hover:border-primary-light dark:hover:border-primary-dark transition-all duration-200 flex items-center justify-center gap-1 group-hover:bg-primary-light/10"
                                >
                                  <Volume2
                                    className={`w-4 h-4 sm:w-3 sm:h-3 ${isPlayingPreview === voice.id ? 'animate-pulse' : ''}`}
                                  />
                                  {isPlayingPreview === voice.id ? 'Playing...' : 'Preview'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                      Back to Signup
                    </button>
                    <button
                      type="submit"
                      disabled={isLoadingForm}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isLoadingForm ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Continuing...
                        </>
                      ) : (
                        <>
                          Continue to Agent Settings
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

      {/* Hidden audio element for voice preview playback */}
      <audio ref={audioRef} />

      <Footer theme={theme} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Mail, Phone, ExternalLink, Loader, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchOnboardingStatus, OnboardingStatus } from '@/utils/apiClient';
import { useAuth } from '@/context/AuthContext';

interface ConfirmationPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function ConfirmationPage({ theme, onToggleTheme }: ConfirmationPageProps) {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBackToDashboard = () => {
    // In a real app, this would redirect to login/dashboard
    navigate('/');
  };

  useEffect(() => {
    if (!authState?.tokens?.accessToken) {
      navigate('/signup', { replace: true });
      return;
    }

    const loadStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetchOnboardingStatus();
        setStatus(response.status);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load onboarding status:', error);
        setErrorMessage('Unable to load your onboarding summary. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();
  }, [authState, navigate]);

  const checklistItems = useMemo(
    () => [
      {
        id: 1,
        label: 'Voice Preferences Saved',
        description: status?.voiceProfile
          ? `Voice: ${status.voiceProfile.name} (${status.voiceProfile.provider})`
          : 'Your AI receptionist voice and communication settings',
        status: status?.voiceProfile ? ('complete' as const) : ('pending' as const)
      },
      {
        id: 2,
        label: 'Square Account Connected',
        description: status?.square?.connected
          ? `Merchant ID: ${status.square.merchantId}`
          : 'Integration enabled for bookings and payments',
        status: status?.square?.connected ? ('complete' as const) : ('pending' as const)
      },
      {
        id: 3,
        label: 'Phone Number Preference',
        description: status?.phonePreference
          ? status.phonePreference.type === 'new'
            ? `Requesting new number${status.phonePreference.areaCode ? ` (area code ${status.phonePreference.areaCode})` : ''}`
            : 'Using existing business number via forwarding'
          : 'Your dedicated AI receptionist phone number or forwarding setup',
        status: status?.phonePreference ? ('complete' as const) : ('pending' as const)
      },
      {
        id: 4,
        label: 'QA Review & Activation',
        description:
          status?.tenant?.qaStatus === 'approved'
            ? 'QA review approved'
            : status?.tenant?.qaStatus === 'in_review'
              ? 'QA review in progress'
              : 'Our team is verifying your configuration',
        status:
          status?.tenant?.qaStatus === 'approved'
            ? ('complete' as const)
            : status?.tenant?.qaStatus === 'in_review'
              ? ('pending' as const)
              : ('pending' as const)
      }
    ],
    [status]
  );

  const completedItems = checklistItems.filter(item => item.status === 'complete').length;
  const progressPercent = (completedItems / checklistItems.length) * 100;

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
          </div>

          <div className="relative z-10 w-full max-w-2xl">
            <div className="space-y-8 animate-fade-in">
              {/* Header */}
              <div className="space-y-3 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-light/20 text-primary-light font-semibold mx-auto">
                  5
                </div>
                <h1 className="heading-2">Setup Complete!</h1>
                <p className="text-light-text-secondary dark:text-dark-text-secondary text-lg">
                  Your AI receptionist is being activated
                </p>
              </div>

              {isLoading && (
                <div className="flex justify-center py-6">
                  <Loader className="h-10 w-10 animate-spin text-primary-light" />
                </div>
              )}

              {/* Main Card */}
              <div className="card space-y-8">
                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Onboarding Progress</span>
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">
                      {completedItems} of {checklistItems.length} complete
                    </span>
                  </div>
                  <div className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-light to-accent-blue transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-3">
                  {checklistItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-4 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                    >
                      <div className="mt-0.5">
                        {item.status === 'complete' ? (
                          <CheckCircle className="w-5 h-5 text-primary-light flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-accent-blue flex items-center justify-center">
                            <Loader className="w-3 h-3 text-accent-blue animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-0.5">{item.label}</h4>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                  <div className="flex gap-3">
                    <Clock className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">Estimated Activation Timeline</p>
                      <ul className="space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
                        <li>
                          • <span className="font-medium">Today</span>: Configuration validation
                        </li>
                        <li>
                          • <span className="font-medium">24-48 hours</span>: QA review & testing
                        </li>
                        <li>
                          • <span className="font-medium">After approval</span>: Live activation
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Support Contact */}
                <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                  <p className="font-semibold text-sm mb-3">Need Help?</p>
                  <div className="space-y-2">
                    <a
                      href="mailto:support@fluentfront.ai"
                      className="flex items-center gap-2 text-sm text-primary-light hover:underline"
                    >
                      <Mail className="w-4 h-4" />
                      support@fluentfront.ai
                    </a>
                    <a
                      href="tel:+1-855-FLUENT-1"
                      className="flex items-center gap-2 text-sm text-primary-light hover:underline"
                    >
                      <Phone className="w-4 h-4" />
                      +1 (855) 358-3681
                    </a>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-accent-blue/10 rounded-lg p-4 border border-accent-blue/30">
                  <h4 className="font-semibold text-sm mb-2">What Happens Next</h4>
                  <ol className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <li className="flex gap-2">
                      <span className="font-semibold text-accent-blue flex-shrink-0">1.</span>
                      <span>We'll test your AI receptionist with sample calls</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-accent-blue flex-shrink-0">2.</span>
                      <span>You'll receive a confirmation email with your phone number</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-accent-blue flex-shrink-0">3.</span>
                      <span>Update your website & marketing materials with your new number</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-accent-blue flex-shrink-0">4.</span>
                      <span>Start receiving calls! You can monitor all activity in your dashboard</span>
                    </li>
                  </ol>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <a href="#" className="flex-1 btn-secondary flex items-center justify-center gap-2 group">
                    <Mail className="w-4 h-4" />
                    View Onboarding Summary
                  </a>
                  <button
                    onClick={handleBackToDashboard}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 group"
                  >
                    Go to Dashboard
                    <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Side Note */}
              <div className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <p>Check your email for updates and your assigned phone number</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer theme={theme} />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { authorizeSquare, fetchOnboardingStatus, OnboardingStatus } from '@/utils/apiClient';
import { useAuth } from '@/context/AuthContext';

type OAuthState = 'pending' | 'authorizing' | 'success' | 'error';

interface SquareOAuthStatusPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const stepperSteps = [
  { id: 1, label: 'Pending Square OAuth', color: 'bg-light-border dark:bg-dark-border' },
  { id: 2, label: 'Authorizing...', color: 'bg-accent-blue' },
  { id: 3, label: 'Success', color: 'bg-primary-light' }
];

export default function SquareOAuthStatusPage({ theme, onToggleTheme }: SquareOAuthStatusPageProps) {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [oauthState, setOAuthState] = useState<OAuthState>('pending');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [merchantId, setMerchantId] = useState<string>('');
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollingRef = useRef<number | null>(null);

  const stopPollingStatus = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    setIsStatusLoading(true);
    try {
      const response = await fetchOnboardingStatus();
      setStatus(response.status);

      if (response.status.square.connected) {
        setMerchantId(response.status.square.merchantId || '');
        setOAuthState('success');
        setErrorMessage('');
        stopPollingStatus();
      } else {
        setOAuthState(prev => {
          if (prev === 'authorizing') {
            return prev;
          }
          if (prev === 'success') {
            return prev;
          }
          return 'pending';
        });
      }
    } catch (error) {
      console.error('Failed to load onboarding status:', error);
    } finally {
      setIsStatusLoading(false);
    }
  }, [stopPollingStatus]);

  const startPollingStatus = useCallback(() => {
    if (pollingRef.current !== null) {
      return;
    }
    pollingRef.current = window.setInterval(() => {
      refreshStatus();
    }, 4000);
  }, [refreshStatus]);

  useEffect(() => {
    if (!authState?.tokens?.accessToken) {
      navigate('/signup', { replace: true });
      return;
    }

    refreshStatus();

    return () => {
      stopPollingStatus();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, [authState, navigate, refreshStatus, stopPollingStatus]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'square_oauth_complete') return;

      if (data.success) {
        setOAuthState('success');
        setMerchantId(data.merchantId || '');
        refreshStatus();
      } else {
        setOAuthState('error');
        setErrorMessage(data.message || 'Square authorization failed. Please try again.');
      }

      stopPollingStatus();

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
        popupRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshStatus, stopPollingStatus]);

  const handleConnectWithSquare = useCallback(async () => {
    if (!authState?.tokens?.accessToken) {
      navigate('/signup');
      return;
    }

    setErrorMessage('');
    setOAuthState('authorizing');

    try {
      const data = await authorizeSquare();

      if (!data.authorizationUrl) {
        throw new Error('Failed to generate Square authorization URL');
      }

      const width = 520;
      const height = 640;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      const popup = window.open(
        data.authorizationUrl,
        'squareOAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup || popup.closed) {
        setOAuthState('error');
        setErrorMessage('Popup blocked. Please allow popups and try again.');
        return;
      }

      popupRef.current = popup;
      startPollingStatus();
    } catch (error) {
      console.error('Square OAuth error:', error);
      setOAuthState('error');
      setErrorMessage(
        (error as any)?.data?.message || (error as Error).message || 'Failed to initiate Square connection'
      );
      stopPollingStatus();
    }
  }, [authState, navigate, startPollingStatus, stopPollingStatus]);

  const handleRetry = () => {
    stopPollingStatus();
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
      popupRef.current = null;
    }
    setOAuthState('pending');
    setErrorMessage('');
    setMerchantId('');
    refreshStatus();
  };

  const handleBack = () => {
    navigate('/agent-settings');
  };

  const handleContinue = () => {
    if (!status?.square || status.square.connected !== true) {
      setErrorMessage('Connect your Square account before moving to the next step.');
      return;
    }
    navigate('/phone-number-choice');
  };

  // Get current step based on state
  const isConnected = status?.square?.connected === true;
  const getCurrentStep = () => {
    if (isConnected) {
      return 3;
    }
    switch (oauthState) {
      case 'pending':
        return 1;
      case 'authorizing':
        return 2;
      case 'success':
        return 3;
      case 'error':
        return 2;
      default:
        return 1;
    }
  };

  const currentStep = getCurrentStep();

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
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-light/20 text-primary-light font-semibold">
                    3
                  </div>
                  <h1 className="heading-2 text-left">Connect with Square</h1>
                </div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Authorize your Square account to enable bookings and payments
                </p>
              </div>

              {/* Card */}
              <div className="card space-y-8">
                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Stepper */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    {stepperSteps.map((step, index) => (
                      <div key={step.id} className="flex flex-1 items-center">
                        {/* Step Circle */}
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                            currentStep >= step.id ? step.color : 'bg-light-border dark:bg-dark-border'
                          } ${currentStep === step.id ? 'ring-2 ring-primary-light ring-offset-2' : ''}`}
                        >
                          {currentStep > step.id ? (
                            <CheckCircle className="w-5 h-5 text-white" />
                          ) : currentStep === step.id && step.id === 2 ? (
                            <Loader className="w-5 h-5 text-white animate-spin" />
                          ) : (
                            <span className="text-white text-sm font-semibold">{step.id}</span>
                          )}
                        </div>

                        {/* Line between steps */}
                        {index < stepperSteps.length - 1 && (
                          <div
                            className={`flex-1 h-1 mx-2 rounded-full transition-all duration-300 ${
                              currentStep > step.id
                                ? 'bg-primary-light'
                                : 'bg-light-border dark:bg-dark-border'
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Step Labels */}
                  <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {stepperSteps.map(step => (
                      <span key={step.id} className="text-center flex-1">
                        {step.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Content based on state */}
                {oauthState === 'pending' && (
                  <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                      <h3 className="font-semibold mb-2">What you'll authorize:</h3>
                      <ul className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <li className="flex gap-2">
                          <CheckCircle className="w-4 h-4 text-primary-light flex-shrink-0 mt-0.5" />
                          <span>Create and manage bookings</span>
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle className="w-4 h-4 text-primary-light flex-shrink-0 mt-0.5" />
                          <span>Process payments</span>
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle className="w-4 h-4 text-primary-light flex-shrink-0 mt-0.5" />
                          <span>View business information</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={handleConnectWithSquare}
                      disabled={isStatusLoading}
                      className="w-full btn-primary py-3 text-center font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isStatusLoading ? 'Checking status...' : 'Connect with Square'}
                    </button>
                  </div>
                )}

                {oauthState === 'authorizing' && (
                  <div className="space-y-6 text-center py-8">
                    <div className="flex justify-center">
                      <Loader className="w-12 h-12 text-accent-blue animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">Authorizing with Square...</h3>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Please complete the authorization in the popup window. This may take a moment.
                      </p>
                    </div>
                  </div>
                )}

                {oauthState === 'success' && (
                  <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-6 border border-primary-light border-2 text-center">
                      <div className="flex justify-center mb-4">
                        <CheckCircle className="w-12 h-12 text-primary-light" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Square Connected!</h3>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                        Your Square account is now connected.
                      </p>
                      <div className="space-y-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {merchantId && (
                          <p className="bg-light-bg dark:bg-dark-bg p-2 rounded">Merchant ID: {merchantId}</p>
                        )}
                        {status?.square && status.square.connected && (
                          <>
                            {status.square.environment && (
                              <p>
                                Environment:{' '}
                                <span className="font-medium text-primary-light">
                                  {status.square.environment}
                                </span>
                              </p>
                            )}
                            {status.square.defaultLocationId && (
                              <p>Default Location ID: {status.square.defaultLocationId}</p>
                            )}
                            <p>
                              Seller-level access:{' '}
                              {status.square.supportsSellerLevelWrites ? 'Enabled' : 'Limited'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                      <h4 className="font-semibold mb-2">Next step:</h4>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Choose how to receive customer calls. You can use a new AI-powered phone number or
                        port your existing number.
                      </p>
                    </div>
                  </div>
                )}

                {oauthState === 'error' && (
                  <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-6 border border-red-500 border-2">
                      <div className="flex justify-center mb-4">
                        <AlertCircle className="w-12 h-12 text-red-500" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2 text-center">Connection Failed</h3>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center mb-4">
                        {errorMessage || 'There was an error connecting to Square. Please try again.'}
                      </p>
                    </div>

                    <button
                      onClick={handleRetry}
                      className="w-full btn-primary py-3 text-center font-semibold"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back
                  </button>
                  {oauthState === 'success' && (
                    <button
                      type="button"
                      onClick={handleContinue}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 group"
                    >
                      Continue to Phone Numbers
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer theme={theme} />
    </div>
  );
}

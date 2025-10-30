import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

type OAuthState = 'pending' | 'authorizing' | 'success' | 'error'

interface SquareOAuthStatusPageProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const stepperSteps = [
  { id: 1, label: 'Pending Square OAuth', color: 'bg-light-border dark:bg-dark-border' },
  { id: 2, label: 'Authorizing...', color: 'bg-accent-blue' },
  { id: 3, label: 'Success', color: 'bg-primary-light' },
]

export default function SquareOAuthStatusPage({
  theme,
  onToggleTheme,
}: SquareOAuthStatusPageProps) {
  const navigate = useNavigate()
  const [oauthState, setOAuthState] = useState<OAuthState>('pending')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [merchantId, setMerchantId] = useState<string>('')

  // Check if user is returning from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('state')
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      setOAuthState('error')
      setErrorMessage(error === 'access_denied' ? 'You declined the authorization' : error)
    } else if (code && state) {
      // User authorized, now exchange code for access token
      setOAuthState('authorizing')
      exchangeCodeForToken(code, state)
    }
  }, [])

  const exchangeCodeForToken = async (code: string, state: string) => {
    try {
      const response = await fetch('/api/onboarding/square/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMerchantId(data.merchantId || '')
        setOAuthState('success')
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname)
      } else {
        setOAuthState('error')
        setErrorMessage(data.message || 'Failed to connect with Square')
      }
    } catch (err) {
      setOAuthState('error')
      setErrorMessage('An error occurred while connecting to Square')
      console.error('OAuth callback error:', err)
    }
  }

  const handleConnectWithSquare = async () => {
    setOAuthState('authorizing')

    try {
      // Get OAuth URL from backend
      const response = await fetch('/api/onboarding/square/authorize')
      const data = await response.json()

      if (data.authorizationUrl) {
        // Open OAuth in a popup or redirect
        const width = 500
        const height = 600
        const left = window.innerWidth / 2 - width / 2
        const top = window.innerHeight / 2 - height / 2

        const popup = window.open(
          data.authorizationUrl,
          'squareOAuth',
          `width=${width},height=${height},left=${left},top=${top}`
        )

        // Check if popup was blocked
        if (!popup || popup.closed) {
          setOAuthState('error')
          setErrorMessage('Popup blocked. Please allow popups and try again.')
          return
        }

        // Poll for popup closure and check for success
        const checkPopup = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkPopup)
            // Don't auto-set success here, wait for the callback to be processed
          }
        }, 1000)
      } else {
        setOAuthState('error')
        setErrorMessage('Failed to get authorization URL')
      }
    } catch (err) {
      setOAuthState('error')
      setErrorMessage('Failed to initiate Square connection')
      console.error('Square OAuth error:', err)
    }
  }

  const handleRetry = () => {
    setOAuthState('pending')
    setErrorMessage('')
    setMerchantId('')
  }

  const handleBack = () => {
    navigate('/agent-settings')
  }

  const handleContinue = () => {
    navigate('/phone-number-choice')
  }

  // Get current step based on state
  const getCurrentStep = () => {
    switch (oauthState) {
      case 'pending':
        return 1
      case 'authorizing':
        return 2
      case 'success':
        return 3
      case 'error':
        return 2
      default:
        return 1
    }
  }

  const currentStep = getCurrentStep()

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
                {/* Stepper */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    {stepperSteps.map((step, index) => (
                      <div key={step.id} className="flex flex-1 items-center">
                        {/* Step Circle */}
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                            currentStep >= step.id
                              ? step.color
                              : 'bg-light-border dark:bg-dark-border'
                          } ${
                            currentStep === step.id
                              ? 'ring-2 ring-primary-light ring-offset-2'
                              : ''
                          }`}
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
                    {stepperSteps.map((step) => (
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
                      className="w-full btn-primary py-3 text-center font-semibold"
                    >
                      Connect with Square
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
                      {merchantId && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg p-2 rounded">
                          Merchant ID: {merchantId}
                        </p>
                      )}
                    </div>

                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                      <h4 className="font-semibold mb-2">Next step:</h4>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Choose how to receive customer calls. You can use a new AI-powered phone number
                        or port your existing number.
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
  )
}

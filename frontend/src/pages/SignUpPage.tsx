import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Building2,
  Briefcase,
  Globe,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AIBotIllustration from '@/components/AIBotIllustration';
import { signup } from '@/utils/apiClient';
import { mapSignupResponseToAuthState, useAuth } from '@/context/AuthContext';

interface SignUpFormData {
  businessName: string;
  industry: string;
  timezone: string;
  email: string;
  password: string;
  confirmPassword: string;
  hasSquareAccount: boolean;
}

interface SignUpPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const SIGNUP_CONTEXT_KEY = 'fluentfront.onboarding.signup';
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
const PASSWORD_REQUIREMENT_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

export default function SignUpPage({ theme, onToggleTheme }: SignUpPageProps) {
  const navigate = useNavigate();
  const { setAuthState } = useAuth();
  const [formData, setFormData] = useState<SignUpFormData>({
    businessName: '',
    industry: '',
    timezone: '',
    email: '',
    password: '',
    confirmPassword: '',
    hasSquareAccount: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);

  const industries = [
    'Healthcare',
    'Retail',
    'Hospitality',
    'Professional Services',
    'Education',
    'Real Estate',
    'Finance',
    'Other'
  ];

  const timezones = [
    'EST (UTC-5)',
    'CST (UTC-6)',
    'MST (UTC-7)',
    'PST (UTC-8)',
    'GMT (UTC+0)',
    'CET (UTC+1)',
    'IST (UTC+5:30)',
    'JST (UTC+9)'
  ];

  const persistSignupContext = (context: Partial<SignUpFormData>) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(SIGNUP_CONTEXT_KEY, JSON.stringify(context));
    } catch {
      // Ignore storage errors (private mode, etc.)
    }
  };

  const getPasswordStrength = (
    password: string
  ): { strength: string; score: number; color: string; percentage: number; meetsRequirements: boolean } => {
    const checks = {
      length: password.length >= 8,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^a-zA-Z0-9]/.test(password)
    };

    const totalChecks = Object.keys(checks).length;
    const metChecks = Object.values(checks).filter(Boolean).length;
    const meetsRequirements = PASSWORD_COMPLEXITY_REGEX.test(password);

    let strength = 'Very Weak';
    let color = 'bg-red-500';

    if (metChecks <= 2) {
      strength = 'Weak';
      color = 'bg-orange-500';
    } else if (metChecks >= 3 && metChecks < totalChecks) {
      strength = 'Medium';
      color = 'bg-yellow-500';
    } else if (metChecks === totalChecks) {
      strength = 'Strong';
      color = 'bg-green-500';
    }

    if (!password) {
      strength = 'Very Weak';
      color = 'bg-red-500';
    }

    return {
      strength,
      score: metChecks,
      color,
      percentage: totalChecks === 0 ? 0 : (metChecks / totalChecks) * 100,
      meetsRequirements
    };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    if (!formData.industry) {
      newErrors.industry = 'Please select an industry';
    }
    if (!formData.timezone) {
      newErrors.timezone = 'Please select a timezone';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!PASSWORD_COMPLEXITY_REGEX.test(formData.password)) {
      newErrors.password = PASSWORD_REQUIREMENT_MESSAGE;
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.hasSquareAccount) {
      newErrors.squareAccount = 'You must have a Square account to continue';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    const nextValue = type === 'checkbox' ? checked : value;

    const nextFormState = {
      ...formData,
      [name]: nextValue
    } as SignUpFormData;

    setFormData(nextFormState);

    if (name === 'email') {
      setEmailValid(validateEmail(String(nextValue)));
    }

    setErrors(prev => {
      const updatedErrors = { ...prev };

      if (prev[name]) {
        delete updatedErrors[name];
      }

      if (name === 'password') {
        if (!PASSWORD_COMPLEXITY_REGEX.test(nextFormState.password)) {
          updatedErrors.password = PASSWORD_REQUIREMENT_MESSAGE;
        } else {
          delete updatedErrors.password;
        }
      }

      if (name === 'confirmPassword' || name === 'password') {
        if (nextFormState.confirmPassword && nextFormState.password !== nextFormState.confirmPassword) {
          updatedErrors.confirmPassword = 'Passwords do not match';
        } else {
          delete updatedErrors.confirmPassword;
        }
      }

      return updatedErrors;
    });

    if (apiError) {
      setApiError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Please fix the errors below');
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      const response = await signup({
        businessName: formData.businessName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        timezone: formData.timezone || undefined,
        industry: formData.industry || undefined,
        name: formData.businessName.trim()
      });

      if (!response?.success) {
        throw new Error('Signup failed');
      }

      setAuthState(mapSignupResponseToAuthState(response));
      persistSignupContext({
        businessName: formData.businessName.trim(),
        industry: formData.industry,
        timezone: formData.timezone
      });

      showToast('success', 'Account created successfully');
      navigate('/voice-preferences');
    } catch (error) {
      const message =
        (error as any)?.data?.message ||
        (error as Error).message ||
        'Failed to create account. Please try again.';
      setApiError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
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

          <div className="relative z-10 w-full max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Illustration (desktop only) */}
              <div className="lg:order-first order-last hidden lg:flex items-center justify-center h-96">
                <AIBotIllustration theme={theme} />
              </div>

              {/* Right side - Form */}
              <div className="space-y-8">
                {/* Mobile - Floating illustration */}
                <div className="lg:hidden h-64">
                  <AIBotIllustration theme={theme} />
                </div>

                {/* Form Card */}
                <div className="card space-y-8 animate-fade-in">
                  {/* Header */}
                  <div className="space-y-3">
                    <h1 className="heading-2 text-left">Create Your Account</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      Let's get your AI receptionist set up and ready to handle calls
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {apiError && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <span>{apiError}</span>
                      </div>
                    )}
                    {/* Business Name */}
                    <div className="space-y-2">
                      <label htmlFor="businessName" className="block text-sm font-medium">
                        Business Name *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                          type="text"
                          id="businessName"
                          name="businessName"
                          value={formData.businessName}
                          onChange={handleChange}
                          placeholder="e.g., Acme Corp"
                          className="w-full pl-10 pr-4 py-2 rounded-button border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:border-primary-light dark:focus:border-primary-dark transition-colors"
                        />
                      </div>
                      {errors.businessName && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.businessName}
                        </p>
                      )}
                    </div>

                    {/* Industry */}
                    <div className="space-y-2">
                      <label htmlFor="industry" className="block text-sm font-medium">
                        Industry *
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-3 w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <select
                          id="industry"
                          name="industry"
                          value={formData.industry}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2 rounded-button border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-primary-light dark:focus:border-primary-dark transition-colors appearance-none"
                        >
                          <option value="">Select an industry</option>
                          {industries.map(ind => (
                            <option key={ind} value={ind}>
                              {ind}
                            </option>
                          ))}
                        </select>
                      </div>
                      {errors.industry && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.industry}
                        </p>
                      )}
                    </div>

                    {/* Timezone */}
                    <div className="space-y-2">
                      <label htmlFor="timezone" className="block text-sm font-medium">
                        Timezone *
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <select
                          id="timezone"
                          name="timezone"
                          value={formData.timezone}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2 rounded-button border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-primary-light dark:focus:border-primary-dark transition-colors appearance-none"
                        >
                          <option value="">Select your timezone</option>
                          {timezones.map(tz => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                      {errors.timezone && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.timezone}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-sm font-medium">
                        Email *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="you@example.com"
                          className={`w-full pl-10 pr-12 py-2 rounded-button border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none transition-colors ${
                            errors.email
                              ? 'border-red-500 focus:border-red-500'
                              : emailValid === true
                                ? 'border-green-500 focus:border-green-500'
                                : 'border-light-border dark:border-dark-border focus:border-primary-light dark:focus:border-primary-dark'
                          }`}
                        />
                        {formData.email && emailValid !== null && (
                          <div className="absolute right-3 top-3">
                            {emailValid ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {errors.email && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.email}
                        </p>
                      )}
                      {formData.email && emailValid === true && !errors.email && (
                        <p className="text-sm text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Email is valid
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label htmlFor="password" className="block text-sm font-medium">
                        Password *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="At least 8 chars with uppercase, lowercase, number & symbol"
                          className={`w-full pl-10 pr-12 py-2 rounded-button border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none transition-colors ${
                            errors.password
                              ? 'border-red-500 focus:border-red-500'
                              : passwordStrength.meetsRequirements
                                ? 'border-green-500 focus:border-green-500'
                                : 'border-light-border dark:border-dark-border focus:border-primary-light dark:focus:border-primary-dark'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {formData.password && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                              Strength: {passwordStrength.strength}
                            </span>
                            {passwordStrength.meetsRequirements && (
                              <span className="text-xs font-medium text-green-500">Meets requirements</span>
                            )}
                          </div>
                          <div className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                              style={{ width: `${passwordStrength.percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {PASSWORD_REQUIREMENT_MESSAGE}
                          </p>
                        </div>
                      )}
                      {errors.password && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.password}
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="block text-sm font-medium">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Confirm your password"
                          className={`w-full pl-10 pr-12 py-2 rounded-button border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none transition-colors ${
                            errors.confirmPassword
                              ? 'border-red-500 focus:border-red-500'
                              : formData.password &&
                                  formData.confirmPassword === formData.password &&
                                  formData.confirmPassword
                                ? 'border-green-500 focus:border-green-500'
                                : 'border-light-border dark:border-dark-border focus:border-primary-light dark:focus:border-primary-dark'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {formData.confirmPassword &&
                        formData.password === formData.confirmPassword &&
                        !errors.confirmPassword && (
                          <p className="text-sm text-green-500 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Passwords match
                          </p>
                        )}
                      {errors.confirmPassword && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.confirmPassword}
                        </p>
                      )}
                    </div>

                    {/* Square Account Checkbox */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="hasSquareAccount"
                          checked={formData.hasSquareAccount}
                          onChange={handleChange}
                          className="w-4 h-4 rounded border-light-border dark:border-dark-border cursor-pointer"
                        />
                        <span className="text-sm">
                          I have a{' '}
                          <a
                            href="#"
                            className="text-primary-light dark:text-primary-dark hover:underline font-medium"
                          >
                            Square account
                          </a>
                        </span>
                      </label>
                      {errors.squareAccount && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {errors.squareAccount}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Continue to Voice Preferences
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>

                    {/* Login Link */}
                    <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      Already have an account?{' '}
                      <a
                        href="/login"
                        className="text-primary-light dark:text-primary-dark hover:underline font-medium"
                      >
                        Sign in
                      </a>
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-button shadow-lg ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      <Footer theme={theme} />
    </div>
  );
}

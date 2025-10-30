type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type AccessTokenProvider = () => string | null;

let accessTokenProvider: AccessTokenProvider = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem('fluentfront.auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      tokens?: {
        accessToken?: string;
      };
    };
    return parsed?.tokens?.accessToken || null;
  } catch {
    return null;
  }
};

export function configureApiClient(provider: AccessTokenProvider) {
  accessTokenProvider = provider;
}

interface ApiFetchOptions extends RequestInit {
  method?: HttpMethod;
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const init: RequestInit = { ...options };
  const headers = new Headers(init.headers || {});

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = accessTokenProvider();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  init.headers = headers;

  const response = await fetch(path, init);
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('text/')) {
    data = await response.text();
  }

  if (!response.ok) {
    const error = new Error(
      (data as { message?: string })?.message || `Request failed with status ${response.status}`
    );
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data as T;
}

export interface SignupRequest {
  businessName: string;
  email: string;
  password: string;
  timezone?: string;
  industry?: string;
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
}

export interface TenantSummary {
  id: string;
  slug: string;
  businessName: string;
  status: string;
  timezone: string;
  qaStatus?: string | null;
  trialEndsAt?: string | null;
}

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
}

export interface SignupResponse {
  success: boolean;
  tenant: TenantSummary;
  user: UserSummary;
  tokens: AuthTokens;
}

export async function signup(payload: SignupRequest): Promise<SignupResponse> {
  return apiFetch<SignupResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  provider?: string;
  accent?: string;
  language?: string;
  default?: boolean;
  previewUrl?: string;
}

export interface VoicesResponse {
  success: boolean;
  voices: VoiceOption[];
}

export async function fetchVoices(): Promise<VoicesResponse> {
  return apiFetch<VoicesResponse>('/api/onboarding/voices', {
    method: 'GET'
  });
}

export interface VoicePreferencesPayload {
  voiceKey: string;
  voiceName?: string;
  voiceProvider?: string;
  businessName?: string;
  phoneNumber?: string;
  timezone?: string;
  industry?: string;
  language?: string;
  temperature?: number;
  speakingRate?: number;
  ambience?: string;
}

export interface VoicePreferencesResponse {
  success: boolean;
  voiceProfile: {
    id: string;
    voice_key: string;
    provider: string;
    language: string;
    temperature: number | null;
    speaking_rate: number | null;
    ambience: string | null;
  };
  tenant?: TenantSummary;
}

export async function saveVoicePreferences(
  payload: VoicePreferencesPayload
): Promise<VoicePreferencesResponse> {
  return apiFetch<VoicePreferencesResponse>('/api/onboarding/preferences', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export interface AuthorizeSquareResponse {
  success: boolean;
  authorizationUrl: string;
  agentId: string;
  environment: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}

export async function authorizeSquare(tier: 'free' | 'paid' = 'free'): Promise<AuthorizeSquareResponse> {
  return apiFetch<AuthorizeSquareResponse>('/api/onboarding/square/authorize', {
    method: 'POST',
    body: JSON.stringify({ tier })
  });
}

export interface OnboardingStatus {
  tenant: TenantSummary;
  voiceProfile: {
    id: string;
    name: string;
    provider: string;
    voiceKey: string;
    language: string;
    temperature: number | null;
    speakingRate: number | null;
    ambience: string | null;
    updatedAt: string;
  } | null;
  square:
    | {
        connected: true;
        merchantId: string;
        environment: string;
        defaultLocationId: string | null;
        supportsSellerLevelWrites: boolean;
        updatedAt: string;
      }
    | {
        connected: false;
      };
  agent: {
    id: string;
    retellAgentId: string;
    status: string;
    qaStatus: string | null;
    phoneNumber: string | null;
    updatedAt: string;
  } | null;
  phonePreference: {
    type: 'new' | 'existing';
    areaCode?: string | null;
    forwardingNumber?: string | null;
    notes?: string | null;
    updatedAt?: string;
  } | null;
}

export interface OnboardingStatusResponse {
  success: boolean;
  status: OnboardingStatus;
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatusResponse> {
  return apiFetch<OnboardingStatusResponse>('/api/onboarding/status', {
    method: 'GET'
  });
}

export interface PhonePreferencePayload {
  option: 'new' | 'existing';
  areaCode?: string;
  forwardingNumber?: string;
  notes?: string;
}

export interface PhonePreferenceResponse {
  success: boolean;
  preference: {
    type: 'new' | 'existing';
    areaCode?: string | null;
    forwardingNumber?: string | null;
    notes?: string | null;
    updatedAt?: string;
  };
  pendingQaId: string | null;
}

export async function savePhonePreference(payload: PhonePreferencePayload): Promise<PhonePreferenceResponse> {
  return apiFetch<PhonePreferenceResponse>('/api/onboarding/phone-preference', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

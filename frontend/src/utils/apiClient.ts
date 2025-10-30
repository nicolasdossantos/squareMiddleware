type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string;
}

type AccessTokenProvider = () => string | null;
type AuthUpdateHandler = (payload: {
  tokens: AuthTokens;
  tenant?: TenantSummary;
  user?: UserSummary;
}) => void;
type AuthResetHandler = () => void;

interface AuthHandlers {
  getAccessToken: AccessTokenProvider;
  onTokensChanged?: AuthUpdateHandler;
  onUnauthorized?: AuthResetHandler;
}

interface ApiFetchOptions extends RequestInit {
  method?: HttpMethod;
}

let authHandlers: AuthHandlers = {
  getAccessToken: () => null
};

let refreshPromise: Promise<AuthTokens | null> | null = null;

export function configureApiClient(handlersOrProvider: AuthHandlers | AccessTokenProvider) {
  if (typeof handlersOrProvider === 'function') {
    authHandlers = {
      getAccessToken: handlersOrProvider
    };
    return;
  }

  authHandlers = { ...handlersOrProvider };
}

function getAccessToken() {
  try {
    return authHandlers.getAccessToken?.() || null;
  } catch {
    return null;
  }
}

function buildRequestInit(options: ApiFetchOptions = {}): RequestInit {
  const init: RequestInit = {
    ...options,
    credentials: options.credentials ?? 'include'
  };

  const headers = new Headers(init.headers || {});

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  init.headers = headers;
  return init;
}

async function parseResponse<T>(response: Response): Promise<T> {
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

async function callRefreshEndpoint(): Promise<AuthTokens | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    const payload = await parseResponse<SignupResponse>(response);
    if (payload?.success && payload.tokens?.accessToken) {
      authHandlers.onTokensChanged?.({
        tokens: payload.tokens,
        tenant: payload.tenant,
        user: payload.user
      });
      return payload.tokens;
    }
  } catch (error) {
    // Swallow – caller handles unauthorized flow
  }

  return null;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = callRefreshEndpoint().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}, retryOn401 = true): Promise<T> {
  try {
    const response = await fetch(path, buildRequestInit(options));
    return await parseResponse<T>(response);
  } catch (error) {
    const status = (error as any)?.status;

    if (status === 401 && retryOn401) {
      const refreshed = await refreshAccessToken();

      if (refreshed && refreshed.accessToken) {
        return apiFetch<T>(path, options, false);
      }

      authHandlers.onUnauthorized?.();
    }

    throw error;
  }
}

export interface SignupRequest {
  businessName: string;
  email: string;
  password: string;
  timezone?: string;
  industry?: string;
  name?: string;
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

export async function logout(options: { revokeAll?: boolean } = {}): Promise<void> {
  const body = options.revokeAll === false ? {} : { all: true };

  await apiFetch('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

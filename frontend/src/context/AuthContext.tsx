import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  configureApiClient,
  SignupResponse,
  TenantSummary,
  UserSummary,
  AuthTokens
} from '@/utils/apiClient';

export interface AuthState {
  tokens: AuthTokens;
  tenant: TenantSummary;
  user: UserSummary;
}

interface AuthContextValue {
  authState: AuthState | null;
  isAuthenticated: boolean;
  setAuthState: (state: AuthState) => void;
  clearAuthState: () => void;
}

const STORAGE_KEY = 'fluentfront.auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function sanitizeState(state: AuthState | null): AuthState | null {
  if (!state) {
    return null;
  }

  return {
    ...state,
    tokens: {
      ...state.tokens,
      refreshToken: null
    }
  };
}

function loadInitialState(): AuthState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

function persistState(state: AuthState | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!state) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const sanitized = sanitizeState(state);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthStateInternal] = useState<AuthState | null>(() => {
    const initial = sanitizeState(loadInitialState());
    if (initial) {
      persistState(initial);
    }
    return initial;
  });

  useEffect(() => {
    const handleTokensChanged = ({
      tokens,
      tenant,
      user
    }: {
      tokens: AuthTokens;
      tenant?: TenantSummary;
      user?: UserSummary;
    }) => {
      setAuthStateInternal(prev => {
        const fallback = prev
          ? { tenant: prev.tenant, user: prev.user }
          : tenant && user
            ? { tenant, user }
            : null;

        if (!fallback) {
          return prev;
        }

        const nextState = sanitizeState({
          tokens,
          tenant: tenant || fallback.tenant,
          user: user || fallback.user
        });

        persistState(nextState);
        return nextState;
      });
    };

    const handleUnauthorized = () => {
      persistState(null);
      setAuthStateInternal(null);
    };

    configureApiClient({
      getAccessToken: () => authState?.tokens?.accessToken || null,
      onTokensChanged: handleTokensChanged,
      onUnauthorized: handleUnauthorized
    });
  }, [authState, setAuthStateInternal]);

  const setAuthState = useCallback((state: AuthState) => {
    const sanitized = sanitizeState(state);
    persistState(sanitized);
    setAuthStateInternal(sanitized);
  }, []);

  const clearAuthState = useCallback(() => {
    persistState(null);
    setAuthStateInternal(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      isAuthenticated: Boolean(authState?.tokens?.accessToken),
      setAuthState,
      clearAuthState
    }),
    [authState, clearAuthState, setAuthState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function mapSignupResponseToAuthState(payload: SignupResponse): AuthState {
  const sanitized = sanitizeState({
    tokens: payload.tokens,
    tenant: payload.tenant,
    user: payload.user
  });

  if (!sanitized) {
    throw new Error('Unable to map signup response to auth state');
  }

  return sanitized;
}

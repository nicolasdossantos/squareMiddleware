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

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthStateInternal] = useState<AuthState | null>(() => loadInitialState());

  useEffect(() => {
    configureApiClient(() => authState?.tokens?.accessToken || null);
  }, [authState]);

  const setAuthState = useCallback((state: AuthState) => {
    persistState(state);
    setAuthStateInternal(state);
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
  return {
    tokens: payload.tokens,
    tenant: payload.tenant,
    user: payload.user
  };
}

// ============================================================================
// AUTH SYSTEM
// ============================================================================
// JWT-based authentication with:
// - Login / Register / Logout
// - Token refresh (silent)
// - Role-based access control (RBAC)
// - Phone OTP login (for Africa)
// - Auth hooks for React
// ============================================================================

// --- TOKEN MANAGER ---

const ACCESS_TOKEN_KEY = 'kobe_access_token';
const REFRESH_TOKEN_KEY = 'kobe_refresh_token';
const USER_KEY = 'kobe_user';

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getStoredUser = (): any | null => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const setUser = (user: any): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// --- JWT DECODE (lightweight, no library needed) ---

export const decodeJWT = (token: string): any | null => {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJWT(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
};

export const getTokenExpiry = (token: string): number => {
  const payload = decodeJWT(token);
  return payload?.exp ? payload.exp * 1000 : 0;
};

// --- AUTH API ---

import { api } from './kobeos-api-client';

export interface LoginCredentials {
  phone?: string;
  email?: string;
  password: string;
}

export interface RegisterData {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role?: string;
}

export interface OTPRequest {
  phone: string;
}

export interface OTPVerify {
  phone: string;
  otp: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: string;
    permissions: string[];
    avatar?: string;
  };
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', credentials);
    if (res.data) {
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
    }
    return res.data!;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', data);
    if (res.data) {
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
    }
    return res.data!;
  },

  requestOTP: async (data: OTPRequest) => {
    return api.post('/auth/otp/request', data);
  },

  verifyOTP: async (data: OTPVerify): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/otp/verify', data);
    if (res.data) {
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
    }
    return res.data!;
  },

  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
    clearTokens();
    window.location.href = '/login';
  },

  me: async (): Promise<AuthResponse['user']> => {
    const res = await api.get<AuthResponse['user']>('/auth/me');
    if (res.data) setUser(res.data);
    return res.data!;
  },

  updateProfile: async (updates: Partial<AuthResponse['user']>) => {
    const res = await api.patch<AuthResponse['user']>('/auth/me', updates);
    if (res.data) setUser(res.data);
    return res.data!;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    return api.post('/auth/change-password', data);
  },
};

// --- REACT AUTH HOOK ---

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface AuthContextType {
  user: AuthResponse['user'] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithOTP: (phone: string, otp: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<AuthResponse['user'] | null>(getStoredUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = getAccessToken();
      if (token && !isTokenExpired(token)) {
        try {
          const userData = await authApi.me();
          setUserState(userData);
        } catch {
          clearTokens();
        }
      } else if (token && isTokenExpired(token)) {
        // Try silent refresh
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            const res = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
            if (res.data) {
              setTokens(res.data.accessToken, res.data.refreshToken);
              setUserState(res.data.user);
            }
          } catch {
            clearTokens();
          }
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const res = await authApi.login(credentials);
    setUserState(res.user);
  }, []);

  const loginWithOTP = useCallback(async (phone: string, otp: string) => {
    const res = await authApi.verifyOTP({ phone, otp });
    setUserState(res.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await authApi.register(data);
    setUserState(res.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUserState(null);
  }, []);

  const hasPermission = useCallback((permission: string) => {
    return user?.permissions?.includes(permission) || false;
  }, [user]);

  const hasRole = useCallback((role: string | string[]) => {
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginWithOTP,
      register,
      logout,
      hasPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// --- ROLE-BASED ROUTE GUARD ---

import type { ReactNode } from 'react';

interface RequireAuthProps {
  children: ReactNode;
  roles?: string[];
  permissions?: string[];
  fallback?: ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, roles, permissions, fallback }) => {
  const { user, isLoading, isAuthenticated, hasRole, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  if (roles && !hasRole(roles)) {
    return fallback || (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#F87171' }}>
        Access Denied: Insufficient role
      </div>
    );
  }

  if (permissions && !permissions.every(p => hasPermission(p))) {
    return fallback || (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#F87171' }}>
        Access Denied: Missing permissions
      </div>
    );
  }

  return <>{children}</>;
};

// --- ROLE-BASED NAVIGATION HELPER ---

export const getDefaultRouteForRole = (role: string): string => {
  const routes: Record<string, string> = {
    'superadmin': '/admin',
    'admin': '/admin',
    'manager': '/dashboard',
    'cashier': '/cargo/payments',
    'staff': '/hotel/orders',
    'customer': '/cargo/track',
    'driver': '/cargo/deliveries',
    'creator': '/creators/dashboard',
    'brand': '/brands/portal',
  };
  return routes[role] || '/dashboard';
};

export const getAllowedModules = (role: string): string[] => {
  const modules: Record<string, string[]> = {
    'superadmin': ['property', 'hotel', 'cargo', 'creators', 'admin', 'analytics'],
    'admin': ['property', 'hotel', 'cargo', 'creators', 'analytics'],
    'manager': ['property', 'hotel', 'cargo', 'analytics'],
    'cashier': ['cargo'],
    'staff': ['hotel'],
    'customer': ['cargo', 'hotel'],
    'driver': ['cargo'],
    'creator': ['creators'],
    'brand': ['creators'],
  };
  return modules[role] || [];
};

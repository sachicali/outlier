import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  is2faVerified?: boolean;
  backupCodesRemaining?: number;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string, rememberMe?: boolean, totpCode?: string) => Promise<any>;
  complete2FALogin: (sessionId: string, totpCode: string) => Promise<any>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: { username?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) => Promise<void>;
}

// Action types
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: User };

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Configure axios
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true; // Important for httpOnly cookies

// Token management
let accessToken: string | null = null;

// Axios interceptors
axios.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      
      try {
        const response = await axios.post('/api/auth/refresh');
        accessToken = response.data.accessToken;
        return axios(original);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        accessToken = null;
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await axios.get('/api/auth/status');
      
      if (response.data.authenticated) {
        dispatch({ type: 'AUTH_SUCCESS', payload: response.data.user });
        
        // If we have a user but no access token, try to refresh
        if (!accessToken) {
          await refreshToken();
        }
      } else {
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  const login = async (identifier: string, password: string, rememberMe = false, totpCode?: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await axios.post('/api/auth/login', {
        username: identifier, // API expects 'username' field
        password,
        rememberMe,
        totpCode,
      });

      // Check if 2FA is required
      if (response.data.requiresTwoFactor) {
        dispatch({ type: 'CLEAR_ERROR' }); // Clear loading state but don't set authenticated
        return {
          requiresTwoFactor: true,
          sessionId: response.data.sessionId,
          message: response.data.message,
        };
      }

      // Normal login success
      if (response.data.tokens) {
        accessToken = response.data.tokens.accessToken;
        dispatch({ type: 'AUTH_SUCCESS', payload: response.data.user });
        
        toast.success('Login successful!');
        return {
          requiresTwoFactor: false,
          user: response.data.user,
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const complete2FALogin = async (sessionId: string, totpCode: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await axios.post('/api/auth/2fa/verify', {
        sessionId,
        totpCode,
      });

      accessToken = response.data.tokens.accessToken;
      dispatch({ type: 'AUTH_SUCCESS', payload: response.data.user });
      
      toast.success('2FA verification successful!');
      return {
        user: response.data.user,
        tokens: response.data.tokens,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '2FA verification failed';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string, confirmPassword: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        confirmPassword,
      });

      if (response.data.tokens) {
        accessToken = response.data.tokens.accessToken;
        dispatch({ type: 'AUTH_SUCCESS', payload: response.data.user });
        
        toast.success('Registration successful!');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      accessToken = null;
      dispatch({ type: 'AUTH_LOGOUT' });
      toast.success('Logged out successfully');
    }
  };

  const refreshToken = async () => {
    try {
      const response = await axios.post('/api/auth/refresh');
      if (response.data.tokens) {
        accessToken = response.data.tokens.accessToken;
        dispatch({ type: 'AUTH_SUCCESS', payload: response.data.user });
      }
    } catch (error) {
      accessToken = null;
      dispatch({ type: 'AUTH_LOGOUT' });
      throw error;
    }
  };

  const updateProfile = async (data: { username?: string; email?: string }) => {
    try {
      const response = await axios.put('/api/auth/profile', data);
      dispatch({ type: 'UPDATE_USER', payload: response.data });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Profile update failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string, confirmNewPassword: string) => {
    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      
      // Password change clears all sessions, so we need to logout
      accessToken = null;
      dispatch({ type: 'AUTH_LOGOUT' });
      toast.success('Password changed successfully. Please log in again.');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Password change failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    complete2FALogin,
    register,
    logout,
    refreshToken,
    clearError,
    updateProfile,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    return <Component {...props} />;
  };
}

// Hook for role-based access
export function useRole() {
  const { user } = useAuth();
  
  return {
    isAdmin: user?.role === 'admin',
    isUser: user?.role === 'user',
    hasRole: (role: string) => user?.role === role,
  };
}
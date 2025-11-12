import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAccessToken } from '@/lib/api/auth';

export interface User {
  id: number;
  email: string;
  displayName?: string | null;
  roles: string[];
  role: string;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user from backend
  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token invalid or expired, clear storage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('currentUser');
          setUser(null);
        } else {
          throw new Error('Failed to fetch user');
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      const userData = data.user;

      // Update localStorage for backwards compatibility
      localStorage.setItem('currentUser', JSON.stringify(userData));

      setUser(userData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (displayName: string) => {
    try {
      setError(null);

      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch('/api/v1/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || 'Failed to update profile');
      }

      const data = await res.json();
      const userData = data.user;

      // Update localStorage for backwards compatibility
      localStorage.setItem('currentUser', JSON.stringify(userData));

      setUser(userData);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    setUser(null);
    window.location.href = '/login';
  };

  // Refresh user data
  const refreshUser = async () => {
    await fetchUser();
  };

  // Fetch user on mount
  useEffect(() => {
    fetchUser();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    fetchUser,
    updateProfile,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

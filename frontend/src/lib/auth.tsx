'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from './api';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'CLIENT';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isClient: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/auth/validate`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        clearTokens();
      }
    } catch {
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore errors on logout
    }
    clearTokens();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAdmin: user?.role === 'ADMIN',
    isClient: user?.role === 'CLIENT',
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { getApiUrl } from './query-client';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';

interface AuthUser {
  teamNumber: number;
  teamId: string;
  teamName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  token: string | null;
  login: (teamNumber: number, password: string) => Promise<void>;
  signup: (teamNumber: number, password: string, teamName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function storeToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch {}
}

async function removeToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const storedToken = await getStoredToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser({ teamNumber: data.teamNumber, teamId: data.teamId });
        setToken(storedToken);
      } else {
        await removeToken();
      }
    } catch (e) {
      await removeToken();
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (teamNumber: number, password: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamNumber, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = await res.json();
    await storeToken(data.token);
    setToken(data.token);
    setUser({ teamNumber: data.teamNumber, teamId: data.id, teamName: data.teamName });
  }, []);

  const signup = useCallback(async (teamNumber: number, password: string, teamName?: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamNumber, password, teamName }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = await res.json();
    await storeToken(data.token);
    setToken(data.token);
    setUser({ teamNumber: data.teamNumber, teamId: data.id, teamName: data.teamName });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        const baseUrl = getApiUrl();
        await fetch(`${baseUrl}api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    await removeToken();
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(() => ({
    user,
    isLoading,
    token,
    login,
    signup,
    logout,
  }), [user, isLoading, token, login, signup, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

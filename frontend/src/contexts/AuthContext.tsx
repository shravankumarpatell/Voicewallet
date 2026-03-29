import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type User = { user_id: string; email: string; name: string; picture: string; monthly_income: number };
type AuthCtx = {
  user: User | null; token: string | null; isLoading: boolean;
  login: (t: string, u: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, isLoading: true,
  login: async () => {}, logout: async () => {}, refreshUser: async () => {},
});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const t = await AsyncStorage.getItem('session_token');
      if (t) {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
        if (res.ok) { setUser(await res.json()); setToken(t); }
        else await AsyncStorage.removeItem('session_token');
      }
    } catch (e) { console.error('Auth check:', e); }
    setIsLoading(false);
  };

  const login = async (t: string, u: User) => {
    await AsyncStorage.setItem('session_token', t);
    setToken(t); setUser(u);
  };

  const logout = async () => {
    if (token) {
      try { await fetch(`${BACKEND_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch {}
    }
    await AsyncStorage.removeItem('session_token');
    setToken(null); setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUser(await res.json());
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const darkColors = {
  background: '#09090B', surface: '#18181B', surfaceElevated: '#27272A',
  textPrimary: '#FAFAFA', textSecondary: '#A1A1AA', border: '#27272A',
  primary: '#FACC15', primaryForeground: '#09090B',
  income: '#34D399', expense: '#F87171',
};
const lightColors = {
  background: '#FAFAFA', surface: '#FFFFFF', surfaceElevated: '#F4F4F5',
  textPrimary: '#09090B', textSecondary: '#71717A', border: '#E4E4E7',
  primary: '#18181B', primaryForeground: '#FAFAFA',
  income: '#10B981', expense: '#EF4444',
};

type ThemeCtx = { isDark: boolean; toggleTheme: () => void; colors: typeof darkColors };
const ThemeContext = createContext<ThemeCtx>({ isDark: true, toggleTheme: () => {}, colors: darkColors });
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => { AsyncStorage.getItem('theme').then(v => { if (v === 'light') setIsDark(false); }); }, []);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors: isDark ? darkColors : lightColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

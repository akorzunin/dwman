import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

export const ThemeList = [
  {
    label: 'Light',
    value: 'light',
  } as const,
  {
    label: 'Dark',
    value: 'dark',
  } as const,
  {
    label: 'Office light',
    value: 'office-light',
  } as const,
  {
    label: 'Office dark',
    value: 'office-dark',
  } as const,
  {
    label: 'Pepega green',
    value: 'pepega-green',
  } as const,
  {
    label: 'Rose pine',
    value: 'rose-pine',
  } as const,
] as const;

export type ThemeLabels = (typeof ThemeList)[number]['label'] | 'System';
export type ThemeValues = (typeof ThemeList)[number]['value'] | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeValues;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: ThemeValues;
  setTheme: (theme: ThemeValues) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeValues>(
    () => (localStorage.getItem(storageKey) as ThemeValues) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove(...ThemeList.map(({ value }) => value));

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'office-dark'
        : 'office-light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: ThemeValues) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};

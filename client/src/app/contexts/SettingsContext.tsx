import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AppSettings {
  display: {
    aspectRatio: '16:9' | '4:3' | '16:10';
    fullscreen: boolean;
  };
  typography: {
    fontFamily: string;
    fontWeight: string;
    italic: boolean;
    fontSize: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    dropShadow: boolean;
    textStroke: boolean;
    lineHeight: number;
    transition: 'none' | 'fade';
  };
  bible: {
    defaultTranslation: string;
    showVerseNumbers: boolean;
    showHeadings: boolean;
  };
  app: {
    theme: 'dark' | 'oled' | 'light';
    autoBlank: boolean;
    enableNDI: boolean;
  };
}

const defaultSettings: AppSettings = {
  display: {
    aspectRatio: '16:9',
    fullscreen: false,
  },
  typography: {
    fontFamily: 'Inter',
    fontWeight: '700',
    italic: false,
    fontSize: 36,
    textAlign: 'center',
    dropShadow: true,
    textStroke: false,
    lineHeight: 1.5,
    transition: 'fade',
  },
  bible: {
    defaultTranslation: 'nasb2020',
    showVerseNumbers: true,
    showHeadings: true,
  },
  app: {
    theme: 'dark',
    autoBlank: false,
    enableNDI: false,
  },
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateSection: <K extends keyof AppSettings>(section: K, values: Partial<AppSettings[K]>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      // @ts-ignore
      const oldSaved = window.electron ? window.electron.storeGet('openflow_settings') : localStorage.getItem('openflow_settings');
      const newSaved = window.electron ? window.electron.storeGet('openbeam_settings') : localStorage.getItem('openbeam_settings');
      const saved = newSaved || oldSaved;
      if (saved) {
        // Deep merge to ensure all properties exist even if schema changed
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        return {
          display: { ...defaultSettings.display, ...parsed.display },
          typography: { ...defaultSettings.typography, ...parsed.typography },
          bible: { ...defaultSettings.bible, ...parsed.bible },
          app: { ...defaultSettings.app, ...parsed.app },
        };
      }
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    // @ts-ignore
    if (window.electron) {
      window.electron.storeSet('openbeam_settings', JSON.stringify(settings));
    } else {
      localStorage.setItem('openbeam_settings', JSON.stringify(settings));
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateSection = <K extends keyof AppSettings>(section: K, values: Partial<AppSettings[K]>) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...values,
      },
    }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateSection }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

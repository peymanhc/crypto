import { useState } from 'react';
import { HlSettings } from '../types/hyperliquid';
import { loadSettings, saveSettings } from '../lib/hyperliquid/session';

// Position sizing and exit preferences for Hyperliquid orders
export const useHlSettings = () => {
  const [settings, setSettings] = useState<HlSettings>(loadSettings);
  const update = <K extends keyof HlSettings>(key: K, value: HlSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };
  return { settings, update };
};

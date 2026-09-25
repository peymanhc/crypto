import { useEffect, useState } from 'react';
import { BacktestConfig } from '../types/backtest';
import { DEFAULT_BACKTEST_CONFIG } from '../lib/backtest';

const STORAGE_KEY = 'backtest-config';

const readSavedConfig = (): BacktestConfig => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return saved ? { ...DEFAULT_BACKTEST_CONFIG, ...saved } : DEFAULT_BACKTEST_CONFIG;
  } catch {
    return DEFAULT_BACKTEST_CONFIG;
  }
};

// The backtest form values, remembered in localStorage between visits
export const useBacktestConfig = () => {
  const [config, setConfig] = useState<BacktestConfig>(readSavedConfig);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // storage unavailable — the form still works for this session
    }
  }, [config]);

  // update('timeframe', '1h') changes one field and keeps the rest
  const update = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) =>
    setConfig((previous) => ({ ...previous, [key]: value }));

  // apply({ timeframe: '1h', candles: 1000 }) changes several fields at once
  const apply = (next: Partial<BacktestConfig>) => setConfig((previous) => ({ ...previous, ...next }));

  return { config, update, apply };
};

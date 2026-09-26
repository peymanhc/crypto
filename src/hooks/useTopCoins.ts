import { useState } from 'react';
import { BacktestConfig } from '../types/backtest';
import { scanTopCoins, TopCoin } from '../lib/backtest/topCoins';
import { findBestSettings, AutoFillResult } from '../lib/backtest/autoFill';

export type TopCoinsPhase = 'idle' | 'scanning' | 'searching';

export interface TopCoinsProgress {
  symbol?: string;
  done: number;
  total: number;
}

// Up to this many of the ranked coins are used by "Auto fill"
const AUTO_FILL_COINS = 4;

// State for the "Top coins" card: the ranking scan and the auto-fill search
export const useTopCoins = (config: BacktestConfig, apply: (next: Partial<BacktestConfig>) => void) => {
  const [phase, setPhase] = useState<TopCoinsPhase>('idle');
  const [progress, setProgress] = useState<TopCoinsProgress>({ done: 0, total: 0 });
  const [coins, setCoins] = useState<TopCoin[] | null>(null);
  const [filled, setFilled] = useState<AutoFillResult | null>(null);
  const [failed, setFailed] = useState(false);

  const busy = phase !== 'idle';

  const findTopCoins = async (): Promise<TopCoin[]> => {
    setPhase('scanning');
    setFailed(false);
    try {
      const ranked = await scanTopCoins(config, (symbol, done, total) => setProgress({ symbol, done, total }));
      setCoins(ranked);
      return ranked;
    } catch {
      setFailed(true);
      return [];
    } finally {
      setPhase('idle');
    }
  };

  const autoFill = async () => {
    if (busy) return;
    const ranked = coins ?? (await findTopCoins());
    const symbols = ranked.slice(0, AUTO_FILL_COINS).map((c) => c.symbol);
    if (symbols.length === 0) return;

    setPhase('searching');
    setFilled(null);
    try {
      const best = await findBestSettings(config, symbols, (done, total) => setProgress({ done, total }));
      if (!best) return;
      const { symbols: s, timeframe, exitMode, targetPct, riskLevels, candles } = best.config;
      apply({ symbols: s, timeframe, exitMode, targetPct, riskLevels, candles });
      setFilled(best);
    } finally {
      setPhase('idle');
    }
  };

  return { phase, busy, progress, coins, filled, failed, findTopCoins, autoFill };
};

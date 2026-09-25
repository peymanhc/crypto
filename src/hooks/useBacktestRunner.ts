import { useRef, useState } from 'react';
import { BacktestConfig, BacktestProgress, BacktestResult } from '../types/backtest';
import { fetchBacktestCandles } from '../lib/backtestData';
import { runBacktest, SymbolCandles } from '../lib/backtest';
import { useI18n } from '../i18n';
import { activeEngineSignal } from '../lib/strategies/backtestSignal';

// Ichimoku needs ~80 candles plus the 200-candle window: below this a run is meaningless
const MIN_CANDLES = 250;

// Loads the history for every coin, runs the simulation, and exposes progress / result / error
export const useBacktestRunner = () => {
  const { t } = useI18n();
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every run so a slow older run cannot overwrite a newer one
  const runId = useRef(0);

  const running = progress !== null && progress.phase !== 'done';

  const loadAllCandles = async (config: BacktestConfig, id: number): Promise<SymbolCandles[]> => {
    const data: SymbolCandles[] = [];
    for (const symbol of config.symbols) {
      setProgress({ phase: 'loading', symbol, value: 0 });
      const candles = await fetchBacktestCandles(symbol, config.timeframe, config.candles, (value) => {
        if (runId.current === id) setProgress({ phase: 'loading', symbol, value });
      });
      if (candles.length < MIN_CANDLES) {
        throw new Error(t('bt.error.fewCandles', { symbol, count: candles.length, timeframe: config.timeframe }));
      }
      data.push({ symbol, candles });
    }
    return data;
  };

  const run = async (config: BacktestConfig) => {
    if (running) return;
    if (config.symbols.length === 0) return setError(t('bt.error.noCoin'));
    if (config.riskLevels.length === 0) return setError(t('bt.error.noRisk'));

    const id = ++runId.current;
    setError(null);
    setResult(null);
    try {
      const data = await loadAllCandles(config, id);
      const outcome = await runBacktest(
        data,
        config,
        (symbol, value) => {
          if (runId.current === id) setProgress({ phase: 'simulating', symbol, value });
        },
        activeEngineSignal()
      );
      if (runId.current !== id) return;
      setResult(outcome);
      setProgress({ phase: 'done', value: 1 });
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : t('bt.error.generic'));
      setProgress(null);
    }
  };

  return { run, running, progress, result, error };
};

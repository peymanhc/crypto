import { BacktestConfig } from '../../types/backtest';

// Default form values for the backtest page
export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  symbols: ['BTC/USDT'],
  timeframe: '15m',
  candles: 2000,
  exitMode: 'profit',
  targetPct: 2,
  riskLevels: ['Low', 'Medium', 'High'],
  feePct: 0.05,
  slippagePct: 0.02,
  sizePct: 10,
  startEquity: 1000,
  maxHoldHours: 24,
};

// The Worker always analyses the latest 200 candles, so the backtest does too
export const ANALYSIS_WINDOW = 200;

// After a close, the autopilot waits at least 30 minutes before re-entering the same coin
export const MIN_COOLDOWN_MS = 30 * 60_000;

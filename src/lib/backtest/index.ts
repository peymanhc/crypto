// Historical simulation of the exact signal + exit rules the app and the autopilot use.
// Pure: no network, no Telegram, no side effects. Steps:
//   1. simulate every coin on its own      (simulateSymbol.ts)
//   2. merge the trades into one balance   (equity.ts)
//   3. summarise                           (stats.ts)
import { Candle } from '../analysis';
import { BacktestConfig, BacktestResult } from '../../types/backtest';
import { simulateSymbol, SymbolRun } from './simulateSymbol';
import { buildEquityCurve } from './equity';
import { buildStats } from './stats';

export { DEFAULT_BACKTEST_CONFIG } from './config';

export interface SymbolCandles {
  symbol: string;
  candles: Candle[];
}

const perSymbolSummary = (run: SymbolRun, trades: BacktestResult['trades']) => {
  const own = trades.filter((t) => t.symbol === run.symbol);
  const wins = own.filter((t) => t.pnlPct > 0).length;
  return {
    symbol: run.symbol,
    trades: own.length,
    winRate: own.length ? (wins / own.length) * 100 : 0,
    pnlPct: own.reduce((total, t) => total + t.pnlPct, 0),
    candles: run.candles,
  };
};

export async function runBacktest(
  data: SymbolCandles[],
  config: BacktestConfig,
  onProgress?: (symbol: string, value: number) => void
): Promise<BacktestResult> {
  const runs: SymbolRun[] = [];
  for (const { symbol, candles } of data) {
    runs.push(await simulateSymbol(symbol, candles, config, (value) => onProgress?.(symbol, value)));
    onProgress?.(symbol, 1);
  }

  const startTime = Math.min(...runs.map((r) => r.from));
  const { trades, equity } = buildEquityCurve(runs.flatMap((r) => r.trades), config, startTime);
  const stats = buildStats(trades, equity, runs, config);
  const perSymbol = runs.map((run) => perSymbolSummary(run, trades));

  return { config, trades, equity, stats, perSymbol };
}

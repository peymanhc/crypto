// Tries every sensible combination of timeframe, exit rule, target and risk filter
// on a set of coins and returns the one with the best return.
import { RiskLevel } from '../../types/trading';
import { BacktestConfig, BacktestExitMode, BacktestResult } from '../../types/backtest';
import { runBacktest, SymbolCandles, SignalFn } from './index';
import { loadCandles, SCAN_CANDLES } from './topCoins';

const TIMEFRAMES = ['15m', '30m', '1h', '4h'];
const PROFIT_TARGETS = [1, 2, 3, 5];
const RISK_SETS: RiskLevel[][] = [['Low'], ['Low', 'Medium'], ['Low', 'Medium', 'High']];
// A combination needs this many trades to count; fewer is luck, not an edge
const MIN_TRADES = 10;

interface Combo {
  timeframe: string;
  exitMode: BacktestExitMode;
  targetPct: number;
  riskLevels: RiskLevel[];
}

export interface AutoFillResult {
  config: BacktestConfig;
  result: BacktestResult;
  combosTried: number;
}

// Every combination of the grids above
const allCombos = (): Combo[] => {
  const combos: Combo[] = [];
  for (const timeframe of TIMEFRAMES) {
    for (const riskLevels of RISK_SETS) {
      for (const targetPct of PROFIT_TARGETS) combos.push({ timeframe, exitMode: 'profit', targetPct, riskLevels });
      combos.push({ timeframe, exitMode: 'tp1', targetPct: 2, riskLevels });
      combos.push({ timeframe, exitMode: 'tpFinal', targetPct: 2, riskLevels });
    }
  }
  return combos;
};

// Bigger is better; combinations with too few trades never win
const scoreOf = (result: BacktestResult): number =>
  result.stats.trades >= MIN_TRADES ? result.stats.totalReturnPct : -Infinity;

export const findBestSettings = async (
  base: BacktestConfig,
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: SignalFn
): Promise<AutoFillResult | null> => {
  const combos = allCombos();
  let best: AutoFillResult | null = null;
  let done = 0;

  for (const timeframe of TIMEFRAMES) {
    // Candles for this timeframe are downloaded once and reused by every combo below
    const data: SymbolCandles[] = [];
    for (const symbol of symbols) {
      try {
        data.push({ symbol, candles: await loadCandles(symbol, timeframe, SCAN_CANDLES) });
      } catch {
        // skip coins whose history is unavailable on this timeframe
      }
    }

    for (const combo of combos.filter((c) => c.timeframe === timeframe)) {
      const config: BacktestConfig = { ...base, ...combo, symbols: data.map((d) => d.symbol), candles: SCAN_CANDLES };
      if (data.length > 0) {
        const result = await runBacktest(data, config, undefined, signal);
        if (!best || scoreOf(result) > scoreOf(best.result)) best = { config, result, combosTried: combos.length };
      }
      done += 1;
      onProgress?.(done, combos.length);
    }
  }

  return best && Number.isFinite(scoreOf(best.result)) ? best : null;
};

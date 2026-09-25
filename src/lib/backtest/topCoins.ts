// Finds the coins our analysis trades best: runs the backtest on the most traded
// Binance pairs and ranks them by return. Read-only market data, nothing is posted.
import { Candle } from '../analysis';
import { BacktestConfig, BacktestStats } from '../../types/backtest';
import { fetchBacktestCandles } from '../backtestData';
import { runBacktest, SignalFn } from './index';

export interface TopCoin {
  rank: number;
  symbol: string;
  stats: BacktestStats;
}

// How many of the most traded pairs are tested
export const UNIVERSE_SIZE = 40;
// Candles per coin during the scan (fewer than a full run keeps it fast)
export const SCAN_CANDLES = 1000;
// A coin needs this many trades before its return means anything
const MIN_TRADES = 5;
const TOP_COUNT = 10;

// Leveraged tokens and stablecoins are not what the analysis is meant for
const EXCLUDED_BASES = new Set(['USDC', 'FDUSD', 'TUSD', 'BUSD', 'DAI', 'USDP', 'EUR', 'PAXG', 'WBTC', 'USD1', 'USDE']);
const isLeveragedToken = (base: string) => /(UP|DOWN|BULL|BEAR)$/.test(base);

interface Ticker {
  symbol: string;
  quoteVolume: string;
}

// The `limit` USDT pairs with the highest 24h volume, as "BASE/USDT"
export const fetchTopVolumePairs = async (limit = UNIVERSE_SIZE): Promise<string[]> => {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const tickers: Ticker[] = await res.json();
  return tickers
    .filter((t) => t.symbol.endsWith('USDT'))
    .map((t) => ({ base: t.symbol.slice(0, -4), volume: Number(t.quoteVolume) }))
    .filter((t) => !EXCLUDED_BASES.has(t.base) && !isLeveragedToken(t.base))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map((t) => `${t.base}/USDT`);
};

// Candles are cached per symbol + timeframe so "Find top coins" and "Auto fill" share downloads
const candleCache = new Map<string, Candle[]>();

export const loadCandles = async (symbol: string, timeframe: string, count: number): Promise<Candle[]> => {
  const key = `${symbol}|${timeframe}|${count}`;
  const cached = candleCache.get(key);
  if (cached) return cached;
  const candles = await fetchBacktestCandles(symbol, timeframe, count);
  candleCache.set(key, candles);
  return candles;
};

// Runs `task` on every item with at most `limit` in flight at once
const runWithLimit = async <T>(items: T[], limit: number, task: (item: T) => Promise<void>) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

// Backtests every coin of the universe with `config` (one coin at a time) and returns the ten best
export const scanTopCoins = async (
  config: BacktestConfig,
  onProgress?: (symbol: string, done: number, total: number) => void,
  signal?: SignalFn
): Promise<TopCoin[]> => {
  const universe = await fetchTopVolumePairs();
  const scored: { symbol: string; stats: BacktestStats }[] = [];
  let done = 0;

  await runWithLimit(universe, 3, async (symbol) => {
    onProgress?.(symbol, done, universe.length);
    try {
      const candles = await loadCandles(symbol, config.timeframe, SCAN_CANDLES);
      const result = await runBacktest([{ symbol, candles }], { ...config, symbols: [symbol], candles: SCAN_CANDLES }, undefined, signal);
      if (result.stats.trades >= MIN_TRADES) scored.push({ symbol, stats: result.stats });
    } catch {
      // A coin that fails to load is simply left out of the ranking
    }
    done += 1;
    onProgress?.(symbol, done, universe.length);
  });

  return scored
    .sort((a, b) => b.stats.totalReturnPct - a.stats.totalReturnPct)
    .slice(0, TOP_COUNT)
    .map((entry, i) => ({ rank: i + 1, ...entry }));
};

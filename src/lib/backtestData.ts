// Historical candles for the backtester. Read-only market data from Binance via the
// existing kline fetcher; nothing here talks to Telegram or the Worker.
import { fetchKlines } from '../services/api';
import { Candle, RawKline, toCandles, aggregateCandles } from './analysis';

const PAGE = 1000;

// Newest `total` candles of `interval`, oldest first, fetched in pages of 1000
const fetchHistory = async (
  symbol: string,
  interval: string,
  total: number,
  onPage?: (loaded: number) => void
): Promise<Candle[]> => {
  const pages: RawKline[][] = [];
  let endTime: number | undefined;
  let loaded = 0;
  while (loaded < total) {
    const limit = Math.min(PAGE, total - loaded);
    const page = await fetchKlines(symbol, interval, limit, endTime);
    if (!page.length) break;
    pages.unshift(page);
    loaded += page.length;
    onPage?.(loaded);
    endTime = page[0][0] - 1;
    if (page.length < limit) break;
  }
  return toCandles(pages.flat());
};

// Same shape the app and the Worker analyse: 45m candles are three aligned 15m candles
export const fetchBacktestCandles = async (
  symbol: string,
  timeframe: string,
  total: number,
  onProgress?: (value: number) => void
): Promise<Candle[]> => {
  if (timeframe === '45m') {
    const raw = await fetchHistory(symbol, '15m', total * 3, (n) => onProgress?.(n / (total * 3)));
    return aggregateCandles(raw, 3, 45 * 60 * 1000);
  }
  return fetchHistory(symbol, timeframe, total, (n) => onProgress?.(n / total));
};

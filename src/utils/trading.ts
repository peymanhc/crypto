import ccxt from 'ccxt';
import talib from 'talib';

import { TradingResult } from '../types/trading';

interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const fetchMarketData = async (
  symbol: string,
  timeframe: string,
  limit = 100
): Promise<OHLCV[]> => {
  const exchange = new ccxt.binance();
  const bars = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  
  return bars.map(bar => ({
    timestamp: new Date(bar[0]),
    open: bar[1],
    high: bar[2],
    low: bar[3],
    close: bar[4],
    volume: bar[5]
  }));
};

export const calculateSMA = (data: OHLCV[], period: number): number[] => {
  const prices = data.map(d => d.close);
  const result = talib.execute({
    name: "SMA",
    startIdx: 0,
    endIdx: prices.length - 1,
    inReal: prices,
    optInTimePeriod: period
  });
  
  return result.result.outReal;
};

export const analyzeTradingStrategy = async (
  symbol: string,
  timeframe: string
): Promise<TradingResult> => {
  try {
    const data = await fetchMarketData(symbol, timeframe);
    const smaShort = calculateSMA(data, 10);
    const smaLong = calculateSMA(data, 50);

    const latestPrice = data[data.length - 1].close;
    const latestSmaShort = smaShort[smaShort.length - 1];
    const latestSmaLong = smaLong[smaLong.length - 1];

    let signal = "No Idea";
    if (latestPrice < latestSmaShort && latestSmaShort > latestSmaLong) {
      signal = "Get Short Position";
    } else if (latestPrice > latestSmaShort && latestSmaShort < latestSmaLong) {
      signal = "Get Long Position";
    }

    return {
      currentPrice: latestPrice,
      smaShort: latestSmaShort,
      smaLong: latestSmaLong,
      signal
    };
  } catch (error) {
    console.error('Error in trading analysis:', error);
    throw new Error('خطا در تحلیل داده‌ها');
  }
};
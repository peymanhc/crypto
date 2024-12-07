import axios from 'axios';
import { TradingResult, TradingFormData } from '../types/trading';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

export const fetchKlines = async (symbol: string, interval: string, limit = 100) => {
  const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
    params: {
      symbol: symbol.replace('/', ''),
      interval,
      limit
    }
  });
  return response.data;
};

export const fetchTradingStrategy = async (data: TradingFormData): Promise<TradingResult> => {
  try {
    const klines = await fetchKlines(data.symbol, data.timeframe);
    const prices = klines.map((kline: any[]) => parseFloat(kline[4]));
    
    // Calculate SMAs
    const smaShort = calculateSMA(prices, 10);
    const smaLong = calculateSMA(prices, 50);
    
    const currentPrice = prices[prices.length - 1];
    const latestSmaShort = smaShort[smaShort.length - 1];
    const latestSmaLong = smaLong[smaLong.length - 1];

    let signal = "No Idea";
    if (currentPrice < latestSmaShort && latestSmaShort > latestSmaLong) {
      signal = "Get Long Position";
    } else if (currentPrice > latestSmaShort && latestSmaShort < latestSmaLong) {
      signal = "Get Short Position";

    }

    return {
      currentPrice,
      smaShort: latestSmaShort,
      smaLong: latestSmaLong,
      signal
    };
  } catch (error) {
    console.error('Error analyzing trading strategy:', error);
    throw new Error('Error analyzing trading strategy');
  }
};

function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}
// Extra indicators for the strategy rules. The ones the dashboard already has
// (SMA, RSI, ATR, Ichimoku, engulfing) are imported from analysis.ts untouched.
import { Candle } from '../analysis';

export const last = <T>(values: T[]): T | undefined => values[values.length - 1];

// Exponential moving average, same length as `prices`
export const calculateEMA = (prices: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    ema.push(i === 0 ? prices[0] : prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

export interface Macd {
  macd: number;
  signal: number;
  histogram: number;
}

// MACD line, its signal line and the histogram, for the latest candle
export const calculateMACD = (prices: number[], fast = 12, slow = 26, signal = 9): Macd | null => {
  if (prices.length < slow + signal) return null;
  const fastEma = calculateEMA(prices, fast);
  const slowEma = calculateEMA(prices, slow);
  const macdLine = fastEma.map((value, i) => value - slowEma[i]);
  const signalLine = calculateEMA(macdLine.slice(slow - 1), signal);
  const macd = last(macdLine) ?? 0;
  const sig = last(signalLine) ?? 0;
  return { macd, signal: sig, histogram: macd - sig };
};

export interface Bollinger {
  upper: number;
  middle: number;
  lower: number;
}

// Bollinger bands for the latest candle
export const calculateBollinger = (prices: number[], period = 20, deviations = 2): Bollinger | null => {
  if (prices.length < period) return null;
  const window = prices.slice(-period);
  const middle = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((sum, p) => sum + (p - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: middle + deviations * stdDev, middle, lower: middle - deviations * stdDev };
};

export interface Donchian {
  high: number;
  low: number;
}

// Highest high / lowest low of the `period` candles BEFORE the latest one
export const calculateDonchian = (candles: Candle[], period = 20): Donchian | null => {
  if (candles.length < period + 1) return null;
  const window = candles.slice(-period - 1, -1);
  return {
    high: Math.max(...window.map((c) => c.high)),
    low: Math.min(...window.map((c) => c.low)),
  };
};

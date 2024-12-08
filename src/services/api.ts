import axios from 'axios';
import { TradingResult, TradingFormData } from '../types/trading';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';


const calculateIchimoku = (klines) => {
  const prices = klines.map(kline => ({
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4])
  }));

  const period9 = 9;
  const period26 = 26;
  const period52 = 52;

  const tenkanSen = (i) => {
    if (i < period9 - 1) return null;
    const slice = prices.slice(i - period9 + 1, i + 1);
    const high = Math.max(...slice.map(p => p.high));
    const low = Math.min(...slice.map(p => p.low));
    return (high + low) / 2;
  };

  const kijunSen = (i) => {
    if (i < period26 - 1) return null;
    const slice = prices.slice(i - period26 + 1, i + 1);
    const high = Math.max(...slice.map(p => p.high));
    const low = Math.min(...slice.map(p => p.low));
    return (high + low) / 2;
  };

  const senkouSpanA = (i) => {
    const tenkan = tenkanSen(i);
    const kijun = kijunSen(i);
    if (tenkan === null || kijun === null) return null;
    return (tenkan + kijun) / 2;
  };

  const senkouSpanB = (i) => {
    if (i < period52 - 1) return null;
    const slice = prices.slice(i - period52 + 1, i + 1);
    const high = Math.max(...slice.map(p => p.high));
    const low = Math.min(...slice.map(p => p.low));
    return (high + low) / 2;
  };

  const chikouSpan = (i) => {
    if (i < period26) return null;
    return prices[i - period26].close;
  };

  const ichimokuData = klines.map((_, i) => ({
    tenkanSen: tenkanSen(i),
    kijunSen: kijunSen(i),
    senkouSpanA: senkouSpanA(i),
    senkouSpanB: senkouSpanB(i),
    chikouSpan: chikouSpan(i)
  }));

  return ichimokuData[ichimokuData.length - 1]; // Return the most recent Ichimoku values
};

const analyzePriceAction = (klines) => {
  const lastKline = klines[klines.length - 1];
  const previousKline = klines[klines.length - 2];

  const lastOpen = parseFloat(lastKline[1]);
  const lastClose = parseFloat(lastKline[4]);

  const previousOpen = parseFloat(previousKline[1]);
  const previousClose = parseFloat(previousKline[4]);

  let priceActionSignal = "Sideways Trend";

  // Example of a basic price action pattern: Bullish engulfing
  if (lastClose > lastOpen && lastClose > previousClose && lastOpen < previousOpen) {
    priceActionSignal = "Bullish";
  }

  // Example of a basic price action pattern: Bearish engulfing
  if (lastClose < lastOpen && lastClose < previousClose && lastOpen > previousOpen) {
    priceActionSignal = "Bearish";
  }

  return priceActionSignal;
};
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

    let signal = "Sideways Trend";
    if (currentPrice < latestSmaShort && latestSmaShort > latestSmaLong) {
      signal = "Get Long Position";
    } else if (currentPrice > latestSmaShort && latestSmaShort < latestSmaLong) {
      signal = "Get Short Position";
    }
    const supportResistanceTrends = analyzeSupportResistanceAndTrends(klines);
    const priceActionSignal = analyzePriceAction(klines);
    const ichimokuValues = calculateIchimoku(klines);

    return {
      currentPrice,
      smaShort: latestSmaShort,
      smaLong: latestSmaLong,
      signal,
      priceActionSignal,
      ichimokuValues,
      ...supportResistanceTrends,
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

function analyzeSupportResistanceAndTrends(klines: any[]): { support: number, resistance: number, trend: string } {
  const highs = klines.map((kline: any[]) => parseFloat(kline[2]));
  const lows = klines.map((kline: any[]) => parseFloat(kline[3]));

  const resistance = Math.max(...highs.slice(-10)); // Highest high of the last 10 periods
  const support = Math.min(...lows.slice(-10)); // Lowest low of the last 10 periods

  const latestClose = parseFloat(klines[klines.length - 1][4]);
  const previousClose = parseFloat(klines[klines.length - 2][4]);

  let trend = 'Sideways';
  if (latestClose > previousClose) {
    trend = 'Uptrend';
  } else if (latestClose < previousClose) {
    trend = 'Downtrend';
  }

  return { support, resistance, trend };
}

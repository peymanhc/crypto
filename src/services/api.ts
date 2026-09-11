import axios from 'axios';
import {
  TradingResult,
  TradingFormData,
  IchimokuValues,
  Recommendation,
  TradePlan,
  RiskLevel,
  CmeGap,
  MultiTimeframeResult,
} from '../types/trading';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Binance kline: [openTime, open, high, low, close, volume, ...]
type RawKline = [number, string, string, string, string, string, ...unknown[]];

interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const toCandles = (klines: RawKline[]): Candle[] =>
  klines.map((kline) => ({
    openTime: kline[0],
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
  }));

export const fetchKlines = async (
  symbol: string,
  interval: string,
  limit = 200,
  endTime?: number
): Promise<RawKline[]> => {
  const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
    params: {
      symbol: symbol.replace('/', ''),
      interval,
      limit,
      ...(endTime ? { endTime } : {}),
    },
  });
  return response.data;
};

// "15m" -> ms of one candle; supports m / h / d / w suffixes
export const timeframeMs = (timeframe: string): number => {
  const amount = parseInt(timeframe, 10);
  if (timeframe.endsWith('w')) return amount * 604_800_000;
  if (timeframe.endsWith('d')) return amount * 86_400_000;
  if (timeframe.endsWith('h')) return amount * 3_600_000;
  return amount * 60_000;
};

interface ExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

let cachedPairs: string[] | null = null;

// All actively trading pairs on Binance spot, as "BASE/QUOTE" (USDT pairs first)
export const fetchTradingPairs = async (): Promise<string[]> => {
  if (cachedPairs) return cachedPairs;
  const response = await axios.get(`${BINANCE_API_BASE}/exchangeInfo`, {
    params: { showPermissionSets: false },
  });
  const symbols: ExchangeSymbol[] = response.data.symbols ?? [];
  cachedPairs = symbols
    .filter((s) => s.status === 'TRADING')
    .map((s) => `${s.baseAsset}/${s.quoteAsset}`)
    .sort((a, b) => {
      const aUsdt = a.endsWith('/USDT') ? 0 : 1;
      const bUsdt = b.endsWith('/USDT') ? 0 : 1;
      return aUsdt - bUsdt || a.localeCompare(b);
    });
  return cachedPairs;
};

// ---------- Telegram channel integration ----------
// One app-level bot (token via .env.local, see .env.example); each user enters
// their OWN channel in the UI and adds the bot as admin there. Note: Vite bakes
// the token into the built bundle, so it is extractable from a public deployment.
const TELEGRAM_BOT_TOKEN = "8848108856:AAEsfl_WRDJy_o1WhLZ8r7Le96s7zSLH3KM"

export const TELEGRAM_BOT_USERNAME = '@SignalPHC_bot';

export const isTelegramConfigured = Boolean(TELEGRAM_BOT_TOKEN);

// Resolves to the Telegram message_id so a later CLOSE can be posted as a reply to it
export const sendSignalToTelegram = async (text: string, channel: string): Promise<number | null> => {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Telegram is not configured');
  }
  const trimmed = channel.trim();
  // Accept "@name", "name", a t.me link, or a numeric -100... id for private channels
  const bare = trimmed.replace(/^https?:\/\/t\.me\//i, '');
  const chatId = /^-?\d+$/.test(bare) || bare.startsWith('@') ? bare : `@${bare}`;
  const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text,
  });
  return response.data?.result?.message_id ?? null;
};

// Optional Cloudflare Worker (see telegram-worker/) that fires a delayed message
// server-side, so auto-close works even after the visitor closes the browser.
const TELEGRAM_WORKER_URL = "https://crypto-signal-scheduler.peymanhc.workers.dev";

export const isAutoCloseAvailable = Boolean(TELEGRAM_WORKER_URL);

export interface TradeContext {
  symbol: string;
  base: string;
  direction: Recommendation;
  entry: number;
  leverage: number;
}

export interface CloseSchedule {
  text: string;
  // time mode: post after a fixed delay (one candle)
  delaySeconds?: number;
  // profit mode: the Worker polls the price and posts once leveraged PnL >= targetPct
  targetPct?: number;
  trade?: TradeContext;
  // Post the CLOSE as a reply to the original signal message
  replyToMessageId?: number | null;
}

export const scheduleCloseMessage = async (channel: string, schedule: CloseSchedule): Promise<void> => {
  if (!TELEGRAM_WORKER_URL) {
    throw new Error('Auto-close worker is not configured');
  }
  const response = await axios.post(`${TELEGRAM_WORKER_URL.replace(/\/$/, '')}/schedule`, {
    channel,
    text: schedule.text,
    ...(schedule.delaySeconds !== undefined ? { delaySeconds: schedule.delaySeconds } : {}),
    ...(schedule.targetPct !== undefined ? { targetPct: schedule.targetPct } : {}),
    ...(schedule.trade ? { trade: schedule.trade } : {}),
    ...(schedule.replyToMessageId ? { replyToMessageId: schedule.replyToMessageId } : {}),
  });
  if (!response.data?.ok) {
    throw new Error('Scheduling failed');
  }
};

// ---------- CME weekend gaps ----------
// CME Bitcoin futures close Friday 17:00 ET and reopen Sunday 18:00 ET. Spot keeps
// trading over the weekend, so the Sunday reopen usually "gaps" away from the Friday
// close; price tends to revisit (fill) that level, which is what the gap-fill signal trades.

const NY_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  hour12: false,
});

const nyWeekdayHour = (timestamp: number): { weekday: string; hour: number } => {
  const parts = NY_FORMAT.formatToParts(new Date(timestamp));
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  return { weekday, hour: hour === 24 ? 0 : hour };
};

// Gaps smaller than this are noise, not tradeable
const MIN_GAP_PCT = 0.05;

// Scans ~7 months of hourly candles (5 pages x 1000) for weekend gaps, newest first
export const fetchCmeGaps = async (symbol: string): Promise<CmeGap[]> => {
  const pages: RawKline[][] = [];
  let endTime: number | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await fetchKlines(symbol, '1h', 1000, endTime);
    if (!page.length) break;
    pages.unshift(page);
    endTime = page[0][0] - 1;
    if (page.length < 1000) break;
  }
  const candles = toCandles(pages.flat());

  const gaps: CmeGap[] = [];
  let fridayClose: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    const { weekday, hour } = nyWeekdayHour(candles[i].openTime);
    // The 16:00 ET hourly candle closes at 17:00 ET = the CME Friday close
    if (weekday === 'Fri' && hour === 16) fridayClose = candles[i].close;
    if (weekday === 'Sun' && hour === 18 && fridayClose !== null) {
      const from = fridayClose;
      const to = candles[i].open;
      const sizePct = ((to - from) / from) * 100;
      if (Math.abs(sizePct) >= MIN_GAP_PCT) {
        let filled = false;
        let filledAt: number | undefined;
        for (let j = i; j < candles.length; j++) {
          const candle = candles[j];
          if ((to > from && candle.low <= from) || (to < from && candle.high >= from)) {
            filled = true;
            filledAt = candle.openTime;
            break;
          }
        }
        gaps.push({ openedAt: candles[i].openTime, from, to, sizePct, filled, filledAt });
      }
      fridayClose = null;
    }
  }
  return gaps.reverse();
};

// Trade back toward the unfilled gap level: TP is the gap, SL is half that distance
// the other way (2:1 reward/risk). Returns null when price already sits on the gap.
export const buildGapFillPlan = (gap: CmeGap, currentPrice: number): TradePlan | null => {
  const target = gap.from;
  const entry = currentPrice;
  const distance = Math.abs(entry - target);
  if (distance / entry < 0.0005) return null;

  const direction: Recommendation = target < entry ? 'Short' : 'Long';
  const risk = distance / 2;
  const stopLoss = direction === 'Long' ? entry - risk : entry + risk;
  const riskPct = (risk / entry) * 100;

  let leverage: number;
  if (riskPct <= 0.5) leverage = 10;
  else if (riskPct <= 1) leverage = 7;
  else if (riskPct <= 2) leverage = 5;
  else if (riskPct <= 3.5) leverage = 3;
  else if (riskPct <= 5) leverage = 2;
  else leverage = 1;

  const riskLevel: RiskLevel = riskPct <= 1 ? 'Low' : riskPct <= 3 ? 'Medium' : 'High';

  return { direction, riskLevel, leverage, entry, takeProfits: [target], stopLoss, score: 0 };
};

export const fetchCurrentPrice = async (symbol: string): Promise<number> => {
  const response = await axios.get(`${BINANCE_API_BASE}/ticker/price`, {
    params: { symbol: symbol.replace('/', '') },
  });
  return parseFloat(response.data.price);
};

function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

// Average True Range over the last `period` candles — the realistic per-candle move size
const calculateATR = (candles: Candle[], period = 14): number | null => {
  if (candles.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      )
    );
  }
  return trueRanges.reduce((a, b) => a + b, 0) / period;
};

// RSI with Wilder's smoothing
const calculateRSI = (closes: number[], period = 14): number | null => {
  if (closes.length < period + 1) return null;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gainSum += delta;
    else lossSum -= delta;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
};

// Midpoint of the highest high and lowest low over `period` candles ending at `endIndex`
const donchianMid = (
  candles: Candle[],
  endIndex: number,
  period: number
): number | null => {
  if (endIndex < period - 1) return null;
  const slice = candles.slice(endIndex - period + 1, endIndex + 1);
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  return (high + low) / 2;
};

interface IchimokuSnapshot extends IchimokuValues {
  cloudTop: number | null;
  cloudBottom: number | null;
}

const DISPLACEMENT = 26;

const calculateIchimoku = (candles: Candle[]): IchimokuSnapshot => {
  const i = candles.length - 1;

  const tenkanSen = donchianMid(candles, i, 9);
  const kijunSen = donchianMid(candles, i, 26);

  const spanAAt = (index: number): number | null => {
    const tenkan = donchianMid(candles, index, 9);
    const kijun = donchianMid(candles, index, 26);
    if (tenkan === null || kijun === null) return null;
    return (tenkan + kijun) / 2;
  };
  const spanBAt = (index: number): number | null => donchianMid(candles, index, 52);

  // The cloud under the CURRENT candle was projected forward from 26 candles ago
  const senkouSpanA = i >= DISPLACEMENT ? spanAAt(i - DISPLACEMENT) : null;
  const senkouSpanB = i >= DISPLACEMENT ? spanBAt(i - DISPLACEMENT) : null;

  // Reference close from 26 candles ago; the Chikou check compares the current close against it
  const chikouSpan = i >= DISPLACEMENT ? candles[i - DISPLACEMENT].close : null;

  const cloudTop =
    senkouSpanA !== null && senkouSpanB !== null
      ? Math.max(senkouSpanA, senkouSpanB)
      : null;
  const cloudBottom =
    senkouSpanA !== null && senkouSpanB !== null
      ? Math.min(senkouSpanA, senkouSpanB)
      : null;

  return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan, cloudTop, cloudBottom };
};

const analyzePriceAction = (candles: Candle[]): string => {
  // The final array element is the still-forming candle — patterns only count on closed candles
  const last = candles[candles.length - 2];
  const prev = candles[candles.length - 3];

  // Engulfing requires an opposite-colored previous candle whose body is fully covered
  const bullishEngulfing =
    prev.close < prev.open &&
    last.close > last.open &&
    last.open <= prev.close &&
    last.close >= prev.open;

  const bearishEngulfing =
    prev.close > prev.open &&
    last.close < last.open &&
    last.open >= prev.close &&
    last.close <= prev.open;

  if (bullishEngulfing) return 'Bullish Engulfing';
  if (bearishEngulfing) return 'Bearish Engulfing';
  return 'Neutral';
};

const analyzeSupportResistance = (candles: Candle[]): { support: number; resistance: number } => {
  const recent = candles.slice(-20);
  return {
    resistance: Math.max(...recent.map((c) => c.high)),
    support: Math.min(...recent.map((c) => c.low)),
  };
};

interface Analysis {
  currentPrice: number;
  smaShort: number;
  smaLong: number;
  support: number;
  resistance: number;
  trend: string;
  priceActionSignal: string;
  ichimoku: IchimokuSnapshot;
  signal: string;
  recommendation: Recommendation;
  bullishPoints: string[];
  bearishPoints: string[];
  atr: number | null;
  rsi: number | null;
  caution: string | null;
}

const analyzeCandles = (candles: Candle[]): Analysis => {
  if (candles.length < 4) {
    throw new Error('Not enough candle data to analyze');
  }

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  const smaShortSeries = calculateSMA(closes, 10);
  const smaLongSeries = calculateSMA(closes, 50);
  const smaShort = smaShortSeries[smaShortSeries.length - 1] ?? NaN;
  const smaLong = smaLongSeries[smaLongSeries.length - 1] ?? NaN;

  const ichimoku = calculateIchimoku(candles);
  const priceActionSignal = analyzePriceAction(candles);
  const { support, resistance } = analyzeSupportResistance(candles);
  const atr = calculateATR(candles);
  const rsi = calculateRSI(closes);

  let trend = 'Sideways';
  if (Number.isFinite(smaShort) && Number.isFinite(smaLong)) {
    if (smaShort > smaLong && currentPrice > smaLong) trend = 'Uptrend';
    else if (smaShort < smaLong && currentPrice < smaLong) trend = 'Downtrend';
  }

  let score = 0;
  const bullishPoints: string[] = [];
  const bearishPoints: string[] = [];

  if (Number.isFinite(smaShort) && Number.isFinite(smaLong)) {
    if (currentPrice > smaShort && smaShort > smaLong) {
      score += 1;
      bullishPoints.push('price above SMA10 and SMA10 above SMA50');
    } else if (currentPrice < smaShort && smaShort < smaLong) {
      score -= 1;
      bearishPoints.push('price below SMA10 and SMA10 below SMA50');
    }
  }

  if (ichimoku.cloudTop !== null && ichimoku.cloudBottom !== null) {
    if (currentPrice > ichimoku.cloudTop) {
      score += 1;
      bullishPoints.push('price above the Ichimoku cloud');
    } else if (currentPrice < ichimoku.cloudBottom) {
      score -= 1;
      bearishPoints.push('price below the Ichimoku cloud');
    }
  }

  if (ichimoku.tenkanSen !== null && ichimoku.kijunSen !== null) {
    if (ichimoku.tenkanSen > ichimoku.kijunSen) {
      score += 1;
      bullishPoints.push('Tenkan-sen above Kijun-sen');
    } else if (ichimoku.tenkanSen < ichimoku.kijunSen) {
      score -= 1;
      bearishPoints.push('Tenkan-sen below Kijun-sen');
    }
  }

  if (ichimoku.chikouSpan !== null) {
    if (currentPrice > ichimoku.chikouSpan) {
      score += 1;
      bullishPoints.push('close above the close of 26 candles ago (Chikou)');
    } else if (currentPrice < ichimoku.chikouSpan) {
      score -= 1;
      bearishPoints.push('close below the close of 26 candles ago (Chikou)');
    }
  }

  if (priceActionSignal === 'Bullish Engulfing') {
    score += 1;
    bullishPoints.push('bullish engulfing candle');
  } else if (priceActionSignal === 'Bearish Engulfing') {
    score -= 1;
    bearishPoints.push('bearish engulfing candle');
  }

  // 5 checks in total; require a clear majority before calling a direction
  let recommendation: Recommendation = 'Neutral';
  if (score >= 2) recommendation = 'Long';
  else if (score <= -2) recommendation = 'Short';

  // Exhaustion filters: when every trend indicator agrees, the move is often already
  // stretched — entering there (especially on low timeframes) buys the top / sells the bottom
  let caution: string | null = null;
  if (recommendation === 'Long') {
    if (rsi !== null && rsi > 70) {
      recommendation = 'Neutral';
      caution = `RSI is overbought (${rsi.toFixed(0)}) — chasing a long here is late`;
    } else if (atr !== null && Number.isFinite(smaShort) && currentPrice - smaShort > 2 * atr) {
      recommendation = 'Neutral';
      caution = 'price is overextended above its short-term mean — wait for a pullback';
    }
  } else if (recommendation === 'Short') {
    if (rsi !== null && rsi < 30) {
      recommendation = 'Neutral';
      caution = `RSI is oversold (${rsi.toFixed(0)}) — chasing a short here is late`;
    } else if (atr !== null && Number.isFinite(smaShort) && smaShort - currentPrice > 2 * atr) {
      recommendation = 'Neutral';
      caution = 'price is overextended below its short-term mean — wait for a bounce';
    }
  }

  const signal =
    recommendation === 'Long'
      ? 'Get Long Position'
      : recommendation === 'Short'
        ? 'Get Short Position'
        : 'Sideways Trend';

  return {
    currentPrice,
    smaShort,
    smaLong,
    support,
    resistance,
    trend,
    priceActionSignal,
    ichimoku,
    signal,
    recommendation,
    bullishPoints,
    bearishPoints,
    atr,
    rsi,
    caution,
  };
};

// SL and TPs are sized from ATR (the realistic per-candle move), not the raw range
// edges, so targets stay proportionate on every timeframe. Wider stop = more
// volatility = less leverage; weak confluence also caps leverage.
const buildTradePlan = (analysis: Analysis): TradePlan => {
  const { recommendation, currentPrice, support, resistance, atr, bullishPoints, bearishPoints } = analysis;
  const score = bullishPoints.length - bearishPoints.length;
  const strength = Math.abs(score);

  if (recommendation === 'Neutral') {
    return {
      direction: 'Neutral',
      riskLevel: 'High',
      leverage: 0,
      entry: currentPrice,
      takeProfits: [],
      stopLoss: 0,
      score,
    };
  }

  const entry = currentPrice;
  // 1.5x ATR stop; fall back to the range edge only when there's too little data for ATR
  const fallbackRisk = Math.abs(entry - (recommendation === 'Long' ? support : resistance));
  const risk = atr !== null ? atr * 1.5 : fallbackRisk;
  const stopLoss = recommendation === 'Long' ? entry - risk : entry + risk;
  const riskPct = (risk / entry) * 100;

  // Stronger confluence justifies holding for more extended targets
  const tpCount = Math.min(4, Math.max(2, strength));
  const takeProfits = Array.from({ length: tpCount }, (_, i) =>
    recommendation === 'Long' ? entry + risk * (i + 1) : entry - risk * (i + 1)
  ).filter((tp) => tp > 0);

  let leverage: number;
  if (riskPct <= 0.5) leverage = 10;
  else if (riskPct <= 1) leverage = 7;
  else if (riskPct <= 2) leverage = 5;
  else if (riskPct <= 3.5) leverage = 3;
  else if (riskPct <= 5) leverage = 2;
  else leverage = 1;
  if (strength <= 2) leverage = Math.min(leverage, 3);

  let riskLevel: RiskLevel = 'Medium';
  if (strength >= 4 && riskPct <= 2) riskLevel = 'Low';
  else if (strength <= 2 || riskPct > 4) riskLevel = 'High';

  return { direction: recommendation, riskLevel, leverage, entry, takeProfits, stopLoss, score };
};

export const fetchTradingStrategy = async (data: TradingFormData): Promise<TradingResult> => {
  try {
    const candles = await fetchCandlesForTimeframe(data.symbol, data.timeframe);
    const analysis = analyzeCandles(candles);

    return {
      currentPrice: analysis.currentPrice,
      smaShort: analysis.smaShort,
      smaLong: analysis.smaLong,
      signal: analysis.signal,
      priceActionSignal: analysis.priceActionSignal,
      trend: analysis.trend,
      support: analysis.support,
      resistance: analysis.resistance,
      ichimokuValues: {
        tenkanSen: analysis.ichimoku.tenkanSen,
        kijunSen: analysis.ichimoku.kijunSen,
        senkouSpanA: analysis.ichimoku.senkouSpanA,
        senkouSpanB: analysis.ichimoku.senkouSpanB,
        chikouSpan: analysis.ichimoku.chikouSpan,
      },
      plan: buildTradePlan(analysis),
    };
  } catch (error) {
    console.error('Error analyzing trading strategy:', error);
    throw new Error('Error analyzing trading strategy');
  }
};

// ---------- Multi-timeframe advice ----------

export const ADVICE_TIMEFRAMES = [
  { value: '1m', label: '1 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hour' },
  { value: '1d', label: '1 day' },
  { value: '1w', label: '1 week' },
];

// Binance has no 45m interval: 45m candles are built from three aligned 15m candles
const aggregateCandles = (candles: Candle[], groupSize: number, groupMs: number): Candle[] => {
  const start = candles.findIndex((c) => c.openTime % groupMs === 0);
  if (start === -1) return [];
  const out: Candle[] = [];
  for (let i = start; i < candles.length; i += groupSize) {
    const group = candles.slice(i, i + groupSize);
    out.push({
      openTime: group[0].openTime,
      open: group[0].open,
      close: group[group.length - 1].close,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
    });
  }
  return out;
};

const fetchCandlesForTimeframe = async (symbol: string, timeframe: string): Promise<Candle[]> => {
  if (timeframe === '45m') {
    const raw = await fetchKlines(symbol, '15m', 600);
    return aggregateCandles(toCandles(raw), 3, 45 * 60 * 1000);
  }
  return toCandles(await fetchKlines(symbol, timeframe, 200));
};

const formatPrice = (value: number): string =>
  Number(value.toPrecision(6)).toString();

const buildReason = (analysis: Analysis): string => {
  const { recommendation, bullishPoints, bearishPoints, support, resistance, caution } = analysis;

  if (caution) {
    const lean = bullishPoints.length > bearishPoints.length ? 'bullish' : 'bearish';
    return (
      `Trend filters lean ${lean}, but ${caution}.\n` +
      `Stay flat until price cools off; the range is ~${formatPrice(support)} to ~${formatPrice(resistance)}.`
    );
  }

  if (recommendation === 'Long') {
    return (
      `Bullish confluence: ${bullishPoints.join(', ')}.\n` +
      `Favor LONG entries; nearest support is ~${formatPrice(support)} and the idea is invalidated on a close back below it.`
    );
  }
  if (recommendation === 'Short') {
    return (
      `Bearish confluence: ${bearishPoints.join(', ')}.\n` +
      `Favor SHORT entries; nearest resistance is ~${formatPrice(resistance)} and the idea is invalidated on a close back above it.`
    );
  }
  const mixed = [...bullishPoints, ...bearishPoints];
  return (
    `Mixed signals${mixed.length ? `: ${mixed.join(', ')}` : ''} — no clear majority among the indicators.\n` +
    `Stay flat and wait for a breakout above ~${formatPrice(resistance)} or a breakdown below ~${formatPrice(support)}.`
  );
};

export const fetchMultiTimeframeAdvice = async (symbol: string): Promise<MultiTimeframeResult> => {
  const [settled, cmeGaps] = await Promise.all([
    Promise.allSettled(
      ADVICE_TIMEFRAMES.map(async ({ value }) => {
        const candles = await fetchCandlesForTimeframe(symbol, value);
        return analyzeCandles(candles);
      })
    ),
    // Gap history is a bonus: a failure here must not break the advice
    fetchCmeGaps(symbol).catch(() => [] as CmeGap[]),
  ]);

  const now = Date.now();
  return {
    advices: settled.map((result, index) => {
      const { value, label } = ADVICE_TIMEFRAMES[index];
      // Gaps that opened inside the ~200-candle window this timeframe's analysis looks at
      const windowStart = now - timeframeMs(value) * 200;
      const gaps = cmeGaps.filter((gap) => gap.openedAt >= windowStart);
      if (result.status === 'rejected') {
        return {
          timeframe: value,
          label,
          recommendation: 'Neutral' as Recommendation,
          reason: 'Could not load data for this timeframe.\nTry again in a moment.',
          gaps,
        };
      }
      return {
        timeframe: value,
        label,
        recommendation: result.value.recommendation,
        reason: buildReason(result.value),
        gaps,
      };
    }),
    cmeGaps,
  };
};

import axios from 'axios';
import {
  TradingResult,
  TradingFormData,
  Recommendation,
  TradePlan,
  RiskLevel,
  CmeGap,
  MultiTimeframeResult,
  AutopilotConfig,
  AutopilotStatus,
} from '../types/trading';
import {
  RawKline,
  Candle,
  toCandles,
  timeframeMs,
  aggregateCandles,
  analyzeCandles,
  buildTradePlan,
  Analysis,
} from '../lib/analysis';

export { timeframeMs } from '../lib/analysis';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

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

// ---------- Autopilot ----------
// The Worker scans the chosen coins on its own timer, posts Low-risk signals to the
// channel and closes them at the profit target — no browser needed once it is on.

export const saveAutopilot = async (config: Omit<AutopilotConfig, 'updatedAt'>): Promise<AutopilotStatus> => {
  if (!TELEGRAM_WORKER_URL) {
    throw new Error('Autopilot worker is not configured');
  }
  const response = await axios.post(`${TELEGRAM_WORKER_URL.replace(/\/$/, '')}/autopilot`, config);
  if (!response.data?.ok) {
    throw new Error(response.data?.error ?? 'Saving autopilot failed');
  }
  return response.data.status;
};

// Closes every open autopilot trade (CLOSE + result reply), clears history, rescans if enabled
export const resetAutopilot = async (channel: string): Promise<AutopilotStatus> => {
  if (!TELEGRAM_WORKER_URL) {
    throw new Error('Autopilot worker is not configured');
  }
  const response = await axios.post(`${TELEGRAM_WORKER_URL.replace(/\/$/, '')}/autopilot`, {
    action: 'reset',
    channel,
  });
  if (!response.data?.ok) {
    throw new Error(response.data?.error ?? 'Reset failed');
  }
  return response.data.status;
};

export const fetchAutopilotStatus = async (channel: string): Promise<AutopilotStatus> => {
  if (!TELEGRAM_WORKER_URL) {
    throw new Error('Autopilot worker is not configured');
  }
  const response = await axios.get(`${TELEGRAM_WORKER_URL.replace(/\/$/, '')}/autopilot`, {
    params: { channel },
  });
  if (!response.data?.ok) {
    throw new Error(response.data?.error ?? 'Loading autopilot failed');
  }
  return response.data.status;
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

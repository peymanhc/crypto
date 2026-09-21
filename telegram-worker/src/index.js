// Server-side companion of the Coin Analysis app. Two Durable Object classes:
//
//   CloseScheduler — one job per signal sent from the UI. Posts an automatic
//                    "CLOSE $COIN" after a fixed delay (time mode) or once the
//                    leveraged PnL reaches a target (profit mode, price polled
//                    every 3s, watch expires after 24h).
//
//   Autopilot      — one per Telegram channel. On its own timer it analyses up to
//                    four coins with the same indicators as the UI, posts every
//                    Low-risk signal to the channel, then watches the price and
//                    closes the trade at the profit target (or at the stop loss /
//                    after 24h), replying under the signal with the result.
//
// The analysis code is shared with the browser app (../../src/lib/analysis.ts);
// wrangler bundles the TypeScript import.

import {
  analyzeCandles,
  buildTradePlan,
  toCandles,
  aggregateCandles,
  timeframeMs,
  baseAsset,
  formatSignalText,
} from '../../src/lib/analysis.ts';

const MAX_DELAY_SECONDS = 2 * 86_400; // 2 days is plenty for a 1d candle
const PROFIT_POLL_MS = 3_000;
const PROFIT_WATCH_MAX_MS = 24 * 3_600_000;

const AUTOPILOT_TICK_MS = 10_000; // price checks for open trades
const AUTOPILOT_SCAN_MS = 5 * 60_000; // look for new Low-risk signals
const AUTOPILOT_MAX_HOLD_MS = 24 * 3_600_000; // a trade that never resolves is closed out
const AUTOPILOT_MAX_COINS = 4;
const AUTOPILOT_RECENT_KEPT = 10;
const AUTOPILOT_HISTORY_KEPT = 500; // closed trades kept for the "report" command
const AUTOPILOT_CLOSE_RETRIES = 3;
const AUTOPILOT_TIMEFRAMES = ['1m', '5m', '15m', '30m', '45m', '1h', '4h', '1d'];
// Hyperliquid pump-short strategy: every 30 min, short (4x) any perp up more than 150% in 24h
const HL_SCAN_MS = 30 * 60_000;
const HL_DEFAULT_PUMP_PCT = 150; // configurable per channel (hlPumpPct)
const HL_MIN_PUMP_PCT = 10;
const HL_MAX_PUMP_PCT = 1000;
const HL_LEVERAGE = 4;
const HL_MIN_DAY_VOLUME_USD = 50_000; // skip dead markets whose "pump" is one stray trade
const HL_SPOT_MIN_DAY_VOLUME_USD = 10_000; // spot pairs are thinner; still skip the dead ones
const HL_COOLDOWN_MS = 24 * 3_600_000; // the 24h change stays elevated for a day; one short per pump
const HL_TP_PCTS = [10, 20]; // take profits 10% and 20% below entry
const HL_SL_PCT = 10; // stop 10% above entry
const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';

// Typing "report 1D" (or 1W / 1M / ALL) in the channel posts a performance summary
// over that window, worded with the matching label.
const REPORT_RANGES = {
  '1D': { label: 'Daily', ms: 86_400_000 },
  '1W': { label: 'Weekly', ms: 7 * 86_400_000 },
  '1M': { label: 'Monthly', ms: 30 * 86_400_000 },
  ALL: { label: 'All-Time', ms: null },
};

const RISK_LEVELS = ['Low', 'Medium', 'High'];
// Configs saved before the risk filter existed behave as they did: Low only
const allowedRiskLevels = (config) =>
  Array.isArray(config.riskLevels) && config.riskLevels.length ? config.riskLevels : ['Low'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });

// Accept "@name", "name", a t.me link, or a numeric -100... id
const normalizeChannel = (channel) => {
  const bare = String(channel).trim().replace(/^https?:\/\/t\.me\//i, '');
  return /^-?\d+$/.test(bare) ? bare : bare.startsWith('@') ? bare : `@${bare}`;
};

const signed = (pct) => `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;

// Replies sit under the signal post, so the coin is already clear — results
// deliberately carry no token name
const formatResultMessage = (pnlPct, reason) => {
  if (reason === 'manual') return pnlPct === null ? '↩️ Closed manually' : `↩️ Closed manually: ${signed(pnlPct)}`;
  if (reason === 'tp') return `🎯 Final take profit hit: closed with ${signed(pnlPct)} profit`;
  if (reason === 'stop') return `🛑 Stop loss hit: ${signed(pnlPct)}`;
  if (reason === 'expired') return `⏱ Closed after 24h: ${signed(pnlPct)}`;
  return `✅ Closed with ${signed(pnlPct)} profit`;
};

const reportDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// The label ("Daily" / "Weekly" / "Monthly" / "All-Time") follows the requested range,
// so the same builder serves every "report" command
const formatReport = (label, closed, openCount, since) => {
  // A manual close whose exit price could not be fetched has no PnL, so it is left out
  // entirely — that keeps the trade count and the win/loss split consistent
  const scored = closed.filter((t) => Number.isFinite(t.pnlPct));
  const total = scored.reduce((sum, t) => sum + t.pnlPct, 0);
  const wins = scored.filter((t) => t.pnlPct > 0).length;
  const lines = [`📊 ${label} Performance Update`, '', `💰 ${label} P&L: ${signed(total)}`];
  if (!scored.length) {
    lines.push('📈 No trades closed in this period.');
  } else {
    const best = scored.reduce((a, b) => (b.pnlPct > a.pnlPct ? b : a));
    const worst = scored.reduce((a, b) => (b.pnlPct < a.pnlPct ? b : a));
    lines.push(`📈 Trades closed: ${scored.length} (${wins} ✅ / ${scored.length - wins} ❌)`);
    lines.push(`🎯 Win rate: ${Math.round((wins / scored.length) * 100)}%`);
    lines.push(`🏆 Best: $${best.base} ${signed(best.pnlPct)}`);
    lines.push(`📉 Worst: $${worst.base} ${signed(worst.pnlPct)}`);
  }
  lines.push(`📌 Open trades: ${openCount}`);
  // "ALL" has no start date of its own: fall back to the oldest trade on record
  const from = since || (scored.length ? Math.min(...scored.map((t) => t.closedAt)) : Date.now());
  lines.push('', `🗓 ${reportDay(from)} → ${reportDay(Date.now())}`);
  return lines.join('\n');
};

const leveragedPnlPct = (direction, entry, leverage, price) => {
  const dir = direction === 'Long' ? 1 : -1;
  return ((price - entry) / entry) * 100 * leverage * dir;
};

// Resolves to the Telegram message_id (or null) so later posts can reply to it
async function sendTelegram(env, chatId, text, replyToMessageId) {
  const token = (env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    }),
  });
  const body = await response.text();
  console.log('telegram send', { chatId, status: response.status, body: body.slice(0, 300) });
  if (!response.ok) throw new Error(`telegram ${response.status}`);
  try {
    return JSON.parse(body)?.result?.message_id ?? null;
  } catch {
    return null;
  }
}

// Posts the channel-convention "CLOSE $COIN" and then the result as a reply to the signal
async function postClose(env, chatId, base, pnlPct, reason, replyToMessageId) {
  await sendTelegram(env, chatId, `CLOSE $${base}`);
  await sendTelegram(env, chatId, formatResultMessage(pnlPct, reason), replyToMessageId);
}

// ---------- market data ----------
// Binance blocks Cloudflare Workers egress IPs entirely (403, even on
// data-api.binance.vision), so prices come from MEXC (identical API shape and
// symbol format, near-identical spot prices) with Bybit as fallback.

async function fetchPrice(symbol) {
  try {
    const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);
    if (res.ok) {
      const price = parseFloat((await res.json()).price);
      if (Number.isFinite(price)) return price;
    }
  } catch {
    // fall through to Bybit
  }
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data?.result?.list?.[0]?.lastPrice);
      if (Number.isFinite(price)) return price;
    }
  } catch {
    // both sources failed this round; caller retries next tick
  }
  return null;
}

// Hyperliquid perps with their 24h change, delisted and near-zero-volume markets excluded
async function fetchHyperliquidMarkets() {
  const res = await fetch(HL_INFO_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });
  if (!res.ok) throw new Error(`hyperliquid ${res.status}`);
  const [meta, ctxs] = await res.json();
  const markets = [];
  (meta?.universe ?? []).forEach((asset, i) => {
    const ctx = ctxs?.[i];
    const mark = parseFloat(ctx?.markPx);
    const prev = parseFloat(ctx?.prevDayPx);
    const volume = parseFloat(ctx?.dayNtlVlm);
    if (asset.isDelisted || !Number.isFinite(mark) || !Number.isFinite(prev) || prev <= 0) return;
    markets.push({ name: asset.name, markPx: mark, changePct: (mark / prev - 1) * 100, volume: Number.isFinite(volume) ? volume : 0 });
  });
  return markets;
}

// Hyperliquid spot pairs (e.g. ANON/USDC). Spot cannot be shorted, but a pumping spot token
// whose base also has a perp is a short candidate, and the rest are worth showing in the UI.
// Contexts are matched by their `coin` field — they are NOT index-aligned with the universe.
async function fetchHyperliquidSpotMarkets() {
  const res = await fetch(HL_INFO_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' }),
  });
  if (!res.ok) throw new Error(`hyperliquid spot ${res.status}`);
  const [meta, ctxs] = await res.json();
  const tokenName = new Map((meta?.tokens ?? []).map((t) => [t.index, t.name]));
  const ctxByCoin = new Map((ctxs ?? []).map((c) => [c.coin, c]));
  const markets = [];
  for (const pair of meta?.universe ?? []) {
    const ctx = ctxByCoin.get(pair.name);
    const mark = parseFloat(ctx?.markPx);
    const prev = parseFloat(ctx?.prevDayPx);
    const volume = parseFloat(ctx?.dayNtlVlm);
    if (!Number.isFinite(mark) || !Number.isFinite(prev) || prev <= 0) continue;
    const base = tokenName.get(pair.tokens?.[0]) ?? pair.name;
    const quote = tokenName.get(pair.tokens?.[1]) ?? 'USDC';
    markets.push({ base, pair: `${base}/${quote}`, markPx: mark, changePct: (mark / prev - 1) * 100, volume: Number.isFinite(volume) ? volume : 0 });
  }
  return markets;
}

async function fetchHyperliquidPrice(coin) {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    });
    if (!res.ok) return null;
    const price = parseFloat((await res.json())?.[coin]);
    return Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

// Open trades know where they were opened; Hyperliquid perps are not on MEXC/Bybit
const fetchTradePrice = (trade) =>
  trade.venue === 'hyperliquid' ? fetchHyperliquidPrice(trade.symbol) : fetchPrice(trade.symbol);

const MEXC_INTERVALS = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '60m', '4h': '4h', '1d': '1d', '1w': '1W' };
const BYBIT_INTERVALS = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };

// Klines in Binance shape: [openTime, open, high, low, close, volume], oldest first
async function fetchKlines(symbol, interval, limit) {
  try {
    const res = await fetch(
      `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${MEXC_INTERVALS[interval]}&limit=${limit}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch {
    // fall through to Bybit
  }
  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${BYBIT_INTERVALS[interval]}&limit=${limit}`
  );
  const data = await res.json();
  const list = data?.result?.list;
  if (!Array.isArray(list) || !list.length) throw new Error(`no candles for ${symbol} ${interval}`);
  // Bybit returns newest first
  return list.slice().reverse().map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]);
}

async function fetchCandlesForTimeframe(symbol, timeframe) {
  if (timeframe === '45m') {
    const raw = await fetchKlines(symbol, '15m', 600);
    return aggregateCandles(toCandles(raw), 3, 45 * 60 * 1000);
  }
  return toCandles(await fetchKlines(symbol, timeframe, 200));
}

// ---------- CloseScheduler ----------

export class CloseScheduler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const job = await request.json();
    await this.state.storage.put('job', job);
    const firstAlarm = job.mode === 'profit' ? Date.now() + PROFIT_POLL_MS : job.sendAt;
    await this.state.storage.setAlarm(firstAlarm);
    return json({ ok: true });
  }

  async alarm() {
    const job = await this.state.storage.get('job');
    if (!job) {
      await this.state.storage.deleteAll();
      return;
    }

    if (job.mode === 'profit') {
      try {
        if (Date.now() < job.expiresAt) {
          const price = await fetchPrice(job.symbol);
          if (price !== null) {
            const pnlPct = leveragedPnlPct(job.direction, job.entry, job.leverage, price);
            if (pnlPct >= job.targetPct) {
              console.log('profit target hit', { symbol: job.symbol, price, pnlPct: pnlPct.toFixed(3) });
              // Legacy jobs carry only the text; new ones know the coin and reply under the signal
              if (job.base) {
                await postClose(this.env, job.chatId, job.base, pnlPct, 'profit', job.replyToMessageId);
              } else {
                await sendTelegram(this.env, job.chatId, job.text, job.replyToMessageId);
              }
              await this.state.storage.deleteAll();
              return;
            }
          } else {
            console.log('price fetch failed', { symbol: job.symbol });
          }
          await this.state.storage.setAlarm(Date.now() + PROFIT_POLL_MS);
          return;
        }
        console.log('profit watch expired', { symbol: job.symbol });
      } catch (err) {
        // Transient failure (network etc.) — keep watching
        console.log('profit watch error', String(err));
        await this.state.storage.setAlarm(Date.now() + PROFIT_POLL_MS);
        return;
      }
      await this.state.storage.deleteAll();
      return;
    }

    // time mode
    try {
      await sendTelegram(this.env, job.chatId, job.text, job.replyToMessageId);
    } catch (err) {
      console.log('alarm error', String(err));
    }
    // Always clean up — a failed send should not retry forever
    await this.state.storage.deleteAll();
  }
}

// ---------- Autopilot ----------

export class Autopilot {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/configure') {
      return this.configure(await request.json());
    }
    if (url.pathname === '/status') {
      return json({ ok: true, status: await this.status() });
    }
    if (url.pathname === '/reset') {
      return this.state.blockConcurrencyWhile(() => this.reset());
    }
    if (url.pathname === '/scan') {
      return this.state.blockConcurrencyWhile(() => this.scanNow());
    }
    if (url.pathname === '/close') {
      const body = await request.json();
      return this.state.blockConcurrencyWhile(() => this.closeTrade(body));
    }
    if (url.pathname === '/report') {
      return this.report(url.searchParams.get('range'));
    }
    return json({ ok: false, error: 'not found' }, 404);
  }

  // "Scan now" from the UI: run both scans immediately, ignoring the intervals
  async scanNow() {
    const config = await this.state.storage.get('config');
    if (!config) return json({ ok: false, error: 'autopilot is not configured' }, 400);
    if (!config.enabled) return json({ ok: false, error: 'turn the autopilot on first' }, 400);
    const trades = (await this.state.storage.get('trades')) ?? { open: [], recent: [] };
    const at = Date.now();
    await this.state.storage.put('lastScanAt', at);
    const results = await this.scanForSignals(config, trades);
    await this.state.storage.put('lastScan', { at, results });
    const failed = results.filter((r) => r.status === 'error');
    await this.state.storage.put('lastError', failed.length ? `${failed[0].coin}: ${failed[0].error}` : null);
    if (config.hlPumpShort) {
      await this.state.storage.put('lastHlScanAt', at);
      await this.state.storage.put('lastHlScan', { at, ...(await this.scanHyperliquidPumps(config, trades)) });
    }
    await this.state.storage.put('trades', trades);
    return json({ ok: true, status: await this.status() });
  }

  // Manual close of one open trade from the UI: CLOSE $COIN + "Closed manually" result reply
  async closeTrade({ symbol, openedAt }) {
    const config = await this.state.storage.get('config');
    const trades = (await this.state.storage.get('trades')) ?? { open: [], recent: [] };
    const index = trades.open.findIndex((t) => t.symbol === symbol && t.openedAt === Number(openedAt));
    if (!config || index === -1) return json({ ok: false, error: 'trade not found (already closed?)' }, 404);
    const trade = trades.open[index];
    const price = await fetchTradePrice(trade);
    const pnlPct = price === null ? null : leveragedPnlPct(trade.direction, trade.entry, trade.leverage, price);
    try {
      await postClose(this.env, normalizeChannel(config.channel), trade.base, pnlPct, 'manual', trade.messageId);
    } catch (err) {
      return json({ ok: false, error: `telegram: ${String(err)}` }, 502);
    }
    trades.open.splice(index, 1);
    trades.recent.unshift({ ...trade, closedAt: Date.now(), exitPrice: price ?? undefined, pnlPct: pnlPct ?? undefined, reason: 'manual' });
    trades.recent = trades.recent.slice(0, AUTOPILOT_RECENT_KEPT);
    await this.state.storage.put('trades', trades);
    await this.appendHistory([trades.recent[0]]);
    return json({ ok: true, status: await this.status() });
  }

  // `recent` only keeps the last 10 closes (enough for the re-entry cooldown), so the
  // report command reads from its own longer log. It survives a reset on purpose: the
  // channel's track record is not scan state.
  async appendHistory(closed) {
    if (!closed.length) return;
    const history = (await this.state.storage.get('history')) ?? [];
    for (const trade of closed) {
      history.unshift({
        base: trade.base,
        direction: trade.direction,
        pnlPct: Number.isFinite(trade.pnlPct) ? trade.pnlPct : null,
        reason: trade.reason,
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
      });
    }
    await this.state.storage.put('history', history.slice(0, AUTOPILOT_HISTORY_KEPT));
  }

  // Answers "report 1D" & co. from the channel
  async report(range) {
    const spec = REPORT_RANGES[String(range).toUpperCase()];
    if (!spec) return json({ ok: false, error: 'bad range' }, 400);
    const [config, trades, history] = await Promise.all([
      this.state.storage.get('config'),
      this.state.storage.get('trades'),
      this.state.storage.get('history'),
    ]);
    if (!config) return json({ ok: false, error: 'not configured' }, 404);
    const since = spec.ms === null ? 0 : Date.now() - spec.ms;
    const closed = (history ?? []).filter((t) => t.closedAt >= since);
    return json({ ok: true, text: formatReport(spec.label, closed, trades?.open?.length ?? 0, since) });
  }

  // Start over: close every open trade in the channel (CLOSE + result reply), forget the
  // history and cooldowns, and if the autopilot is on, scan again right away
  async reset() {
    const config = await this.state.storage.get('config');
    const trades = (await this.state.storage.get('trades')) ?? { open: [], recent: [] };
    const failures = [];
    if (config) {
      const chatId = normalizeChannel(config.channel);
      for (const trade of trades.open) {
        const price = await fetchTradePrice(trade);
        const pnlPct = price === null ? null : leveragedPnlPct(trade.direction, trade.entry, trade.leverage, price);
        try {
          await postClose(this.env, chatId, trade.base, pnlPct, 'manual', trade.messageId);
        } catch (err) {
          failures.push(`${trade.base}: ${String(err)}`);
        }
      }
    }
    await this.state.storage.put('trades', { open: [], recent: [] });
    await this.state.storage.delete(['lastScan', 'lastScanAt', 'lastHlScan', 'lastHlScanAt']);
    await this.state.storage.put('lastError', failures.length ? `reset: ${failures.join('; ')}` : null);
    if (config?.enabled) {
      await this.state.storage.setAlarm(Date.now() + 1_000);
    }
    return json({ ok: true, status: await this.status() });
  }

  async status() {
    const [config, trades, lastScanAt, lastError, lastScan, lastHlScan] = await Promise.all([
      this.state.storage.get('config'),
      this.state.storage.get('trades'),
      this.state.storage.get('lastScanAt'),
      this.state.storage.get('lastError'),
      this.state.storage.get('lastScan'),
      this.state.storage.get('lastHlScan'),
    ]);
    return {
      config: config ?? null,
      openTrades: trades?.open ?? [],
      recentTrades: trades?.recent ?? [],
      lastScanAt: lastScanAt ?? null,
      lastError: lastError ?? null,
      lastScan: lastScan ?? null,
      lastHlScan: lastHlScan ?? null,
    };
  }

  async configure(config) {
    const prev = await this.state.storage.get('config');
    await this.state.storage.put('config', { ...config, updatedAt: Date.now() });
    // Changed settings should show their effect within one tick, not after the full interval
    const scanKey = (c) => JSON.stringify([c?.coins, c?.timeframe, c?.riskLevels]);
    const hlKey = (c) => JSON.stringify([c?.hlPumpShort, c?.hlPumpPct]);
    if (scanKey(prev) !== scanKey(config)) await this.state.storage.delete('lastScanAt');
    if (hlKey(prev) !== hlKey(config)) await this.state.storage.delete('lastHlScanAt');
    if (config.enabled) {
      // Open trades for coins no longer on the list keep being watched until they
      // resolve — followers were told about them, so they still deserve a CLOSE
      await this.state.storage.setAlarm(Date.now() + 1_000);
    } else {
      // Off = nothing more is posted. Open trades stay recorded and resume watching if re-enabled.
      await this.state.storage.deleteAlarm();
    }
    return json({ ok: true, status: await this.status() });
  }

  // Alarm and UI actions (scan / close / reset) all touch `trades`; blockConcurrencyWhile keeps
  // them from interleaving while one of them is awaiting an exchange or Telegram call
  async alarm() {
    await this.state.blockConcurrencyWhile(() => this.tick());
  }

  async tick() {
    const config = await this.state.storage.get('config');
    if (!config?.enabled) return;

    const trades = (await this.state.storage.get('trades')) ?? { open: [], recent: [] };
    try {
      await this.checkOpenTrades(config, trades);
      const lastScanAt = (await this.state.storage.get('lastScanAt')) ?? 0;
      if (Date.now() - lastScanAt >= AUTOPILOT_SCAN_MS) {
        // Stamp first so a failing Telegram call cannot turn the 5-minute scan into a 10-second hammer
        const at = Date.now();
        await this.state.storage.put('lastScanAt', at);
        const results = await this.scanForSignals(config, trades);
        await this.state.storage.put('lastScan', { at, results });
        // The per-coin results carry their own errors; a completed scan clears the tick-level one
        const failed = results.filter((r) => r.status === 'error');
        await this.state.storage.put('lastError', failed.length ? `${failed[0].coin}: ${failed[0].error}` : null);
      }
      if (config.hlPumpShort) {
        const lastHlScanAt = (await this.state.storage.get('lastHlScanAt')) ?? 0;
        if (Date.now() - lastHlScanAt >= HL_SCAN_MS) {
          const at = Date.now();
          await this.state.storage.put('lastHlScanAt', at);
          await this.state.storage.put('lastHlScan', { at, ...(await this.scanHyperliquidPumps(config, trades)) });
        }
      }
    } catch (err) {
      // Kept until the next scan completes, so a failure is visible in the UI
      await this.state.storage.put('lastError', String(err));
      console.log('autopilot error', { channel: config.channel, error: String(err) });
    }
    await this.state.storage.put('trades', trades);
    await this.state.storage.setAlarm(Date.now() + AUTOPILOT_TICK_MS);
  }

  async checkOpenTrades(config, trades) {
    const chatId = normalizeChannel(config.channel);
    const stillOpen = [];
    const justClosed = [];
    for (let trade of trades.open) {
      const price = await fetchTradePrice(trade);
      if (price === null) {
        stillOpen.push(trade);
        continue;
      }
      const pnlPct = leveragedPnlPct(trade.direction, trade.entry, trade.leverage, price);
      const stopHit =
        trade.direction === 'Long' ? price <= trade.stopLoss : price >= trade.stopLoss;
      const reached = (level) => (trade.direction === 'Long' ? price >= level : price <= level);
      let reason = null;
      if (stopHit) reason = 'stop';
      else if (Array.isArray(trade.takeProfits) && trade.takeProfits.length) {
        // Trades with their own TP ladder (Hyperliquid pump shorts) ignore the channel profit %:
        // intermediate TPs are announced under the signal, the final TP closes the trade
        const finalTp = trade.takeProfits[trade.takeProfits.length - 1];
        if (reached(finalTp)) reason = 'tp';
        else {
          const hit = trade.takeProfits.filter((tp) => reached(tp)).length;
          if (hit > (trade.tpHit ?? 0)) {
            try {
              await sendTelegram(
                this.env,
                chatId,
                `🎯 TP${hit} hit: ${signed(pnlPct)} — hold for TP${trade.takeProfits.length}`,
                trade.messageId
              );
            } catch (err) {
              console.log('tp notify failed', { symbol: trade.symbol, error: String(err) });
            }
            trade = { ...trade, tpHit: hit };
          }
        }
      } else if (pnlPct >= trade.targetPct) reason = 'profit';
      if (!reason && Date.now() - trade.openedAt > AUTOPILOT_MAX_HOLD_MS) reason = 'expired';

      if (!reason) {
        stillOpen.push(trade);
        continue;
      }
      console.log('autopilot close', { symbol: trade.symbol, reason, price, pnlPct: pnlPct.toFixed(3) });
      try {
        await postClose(this.env, chatId, trade.base, pnlPct, reason, trade.messageId);
      } catch (err) {
        // Telegram hiccup: keep the trade open and retry next tick, but not forever
        const closeAttempts = (trade.closeAttempts ?? 0) + 1;
        console.log('autopilot close failed', { symbol: trade.symbol, closeAttempts, error: String(err) });
        if (closeAttempts < AUTOPILOT_CLOSE_RETRIES) {
          stillOpen.push({ ...trade, closeAttempts });
          continue;
        }
      }
      const closed = { ...trade, closedAt: Date.now(), exitPrice: price, pnlPct, reason };
      trades.recent.unshift(closed);
      justClosed.push(closed);
    }
    trades.open = stillOpen;
    trades.recent = trades.recent.slice(0, AUTOPILOT_RECENT_KEPT);
    await this.appendHistory(justClosed);
  }

  // Returns one result per coin so the UI can show why a coin did or did not post
  async scanForSignals(config, trades) {
    const chatId = normalizeChannel(config.channel);
    // After a close, wait at least one candle (min 30 min) before re-entering the same coin
    const cooldownMs = Math.max(timeframeMs(config.timeframe), 30 * 60_000);
    const now = Date.now();
    const results = [];

    for (const coin of config.coins) {
      const symbol = coin.replace('/', '');
      if (trades.open.some((t) => t.symbol === symbol)) {
        results.push({ coin, status: 'open' });
        continue;
      }
      const lastClosed = trades.recent.find((t) => t.symbol === symbol);
      if (lastClosed && now - lastClosed.closedAt < cooldownMs) {
        results.push({ coin, status: 'cooldown' });
        continue;
      }

      // One coin failing (exchange or Telegram) must not stop the others
      try {
        const candles = await fetchCandlesForTimeframe(symbol, config.timeframe);
        const plan = buildTradePlan(analyzeCandles(candles));
        const base = { coin, direction: plan.direction, riskLevel: plan.riskLevel, score: plan.score };
        if (plan.direction === 'Neutral' || !allowedRiskLevels(config).includes(plan.riskLevel)) {
          results.push({ ...base, status: 'no-signal' });
          continue;
        }

        const messageId = await sendTelegram(this.env, chatId, formatSignalText(coin, plan));
        console.log('autopilot signal', { symbol, direction: plan.direction, entry: plan.entry, messageId });
        trades.open.push({
          symbol,
          base: baseAsset(coin),
          direction: plan.direction,
          entry: plan.entry,
          leverage: plan.leverage,
          stopLoss: plan.stopLoss,
          targetPct: config.targetPct,
          openedAt: now,
          messageId,
        });
        results.push({ ...base, status: 'posted' });
      } catch (err) {
        console.log('autopilot coin error', { symbol, error: String(err) });
        results.push({ coin, status: 'error', error: String(err) });
      }
    }
    return results;
  }

  // Mean-reversion short on Hyperliquid pumps: any perp up more than 150% in 24h gets a
  // 4x SHORT signal (TP 10% / 20% below, SL 10% above); tracked like every other trade
  async scanHyperliquidPumps(config, trades) {
    const chatId = normalizeChannel(config.channel);
    const now = Date.now();
    let markets;
    try {
      markets = await fetchHyperliquidMarkets();
    } catch (err) {
      return { checked: 0, pumps: [], error: String(err) };
    }
    const threshold = Number.isFinite(Number(config.hlPumpPct)) ? Number(config.hlPumpPct) : HL_DEFAULT_PUMP_PCT;
    // Spot is informational: a spot-only pump cannot be shorted, but it should be visible
    let spot = [];
    let spotError;
    try {
      spot = await fetchHyperliquidSpotMarkets();
    } catch (err) {
      spotError = String(err);
    }
    const perpNames = new Set(markets.map((m) => m.name));
    const liveSpot = spot.filter((m) => m.volume >= HL_SPOT_MIN_DAY_VOLUME_USD);
    // The biggest 24h gainers, threshold or not, so the UI shows what the Worker is looking at
    const top = [
      ...markets.filter((m) => m.volume >= HL_MIN_DAY_VOLUME_USD).map((m) => ({ coin: m.name, changePct: m.changePct, market: 'perp' })),
      ...liveSpot.map((m) => ({ coin: m.pair, changePct: m.changePct, market: 'spot' })),
    ]
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 6);
    const pumps = [];
    // Spot pumps whose base has no perp: reported, not traded (the perp loop below covers the rest)
    for (const m of liveSpot) {
      if (m.changePct >= threshold && !perpNames.has(m.base)) {
        pumps.push({ coin: m.pair, changePct: m.changePct, status: 'spot-no-perp' });
      }
    }
    for (const market of markets) {
      if (market.changePct < threshold) continue;
      const entry = { coin: market.name, changePct: market.changePct };
      if (market.volume < HL_MIN_DAY_VOLUME_USD) {
        pumps.push({ ...entry, status: 'low-volume' });
        continue;
      }
      if (trades.open.some((t) => t.venue === 'hyperliquid' && t.symbol === market.name)) {
        pumps.push({ ...entry, status: 'open' });
        continue;
      }
      const lastClosed = trades.recent.find((t) => t.venue === 'hyperliquid' && t.symbol === market.name);
      if (lastClosed && now - lastClosed.closedAt < HL_COOLDOWN_MS) {
        pumps.push({ ...entry, status: 'cooldown' });
        continue;
      }
      const price = market.markPx;
      const plan = {
        direction: 'Short',
        riskLevel: 'High',
        leverage: HL_LEVERAGE,
        entry: price,
        takeProfits: HL_TP_PCTS.map((pct) => price * (1 - pct / 100)),
        stopLoss: price * (1 + HL_SL_PCT / 100),
        score: 0,
      };
      try {
        const text = `${formatSignalText(market.name, plan)}\n24h change: +${market.changePct.toFixed(0)}% · Hyperliquid`;
        const messageId = await sendTelegram(this.env, chatId, text);
        console.log('autopilot hl pump short', { coin: market.name, changePct: market.changePct.toFixed(1), entry: price, messageId });
        trades.open.push({
          symbol: market.name,
          base: market.name,
          venue: 'hyperliquid',
          strategy: 'hl-pump-short',
          direction: 'Short',
          entry: price,
          leverage: HL_LEVERAGE,
          stopLoss: plan.stopLoss,
          // Closed by its own TP ladder, not by the channel profit %
          takeProfits: plan.takeProfits,
          tpHit: 0,
          targetPct: config.targetPct,
          openedAt: now,
          messageId,
        });
        pumps.push({ ...entry, status: 'posted' });
      } catch (err) {
        console.log('autopilot hl pump error', { coin: market.name, error: String(err) });
        pumps.push({ ...entry, status: 'error', error: String(err) });
      }
    }
    return { checked: markets.length, spotChecked: spot.length, threshold, top, pumps, ...(spotError ? { spotError } : {}) };
  }
}

// ---------- HTTP entry ----------

const validateAutopilotConfig = (body) => {
  const { channel, enabled, coins, timeframe, targetPct, riskLevels, hlPumpShort, hlPumpPct } = body ?? {};
  if (!channel || typeof channel !== 'string') return { error: 'channel required' };
  if (typeof enabled !== 'boolean') return { error: 'enabled must be boolean' };
  if (!Array.isArray(coins) || coins.length < 1 || coins.length > AUTOPILOT_MAX_COINS) {
    return { error: `pick 1 to ${AUTOPILOT_MAX_COINS} coins` };
  }
  const cleanCoins = [...new Set(coins.map((c) => String(c).trim().toUpperCase()))];
  if (!cleanCoins.every((c) => /^[A-Z0-9]{2,15}\/[A-Z0-9]{2,10}$/.test(c))) {
    return { error: 'coins must look like BTC/USDT' };
  }
  if (!AUTOPILOT_TIMEFRAMES.includes(timeframe)) return { error: 'bad timeframe' };
  const pct = Number(targetPct);
  if (!Number.isFinite(pct) || pct < 0.1 || pct > 100) return { error: 'targetPct must be 0.1-100' };
  const risks = riskLevels === undefined ? ['Low'] : riskLevels;
  if (!Array.isArray(risks) || risks.length < 1 || !risks.every((r) => RISK_LEVELS.includes(r))) {
    return { error: 'pick at least one risk level (Low, Medium, High)' };
  }
  if (hlPumpShort !== undefined && typeof hlPumpShort !== 'boolean') return { error: 'hlPumpShort must be boolean' };
  const pumpPct = hlPumpPct === undefined ? HL_DEFAULT_PUMP_PCT : Number(hlPumpPct);
  if (!Number.isFinite(pumpPct) || pumpPct < HL_MIN_PUMP_PCT || pumpPct > HL_MAX_PUMP_PCT) {
    return { error: `hlPumpPct must be ${HL_MIN_PUMP_PCT}-${HL_MAX_PUMP_PCT}` };
  }
  return {
    config: {
      channel: normalizeChannel(channel),
      enabled,
      coins: cleanCoins,
      timeframe,
      targetPct: pct,
      riskLevels: RISK_LEVELS.filter((r) => risks.includes(r)),
      hlPumpShort: hlPumpShort === true,
      hlPumpPct: pumpPct,
    },
  };
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);

    // Diagnostic: verifies which price sources are reachable from production
    if (request.method === 'GET' && url.pathname === '/health') {
      const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
      const sources = {
        binanceVision: `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`,
        bybit: `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`,
        okx: `https://www.okx.com/api/v5/market/ticker?instId=${symbol.replace('USDT', '-USDT')}`,
        kucoin: `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol.replace('USDT', '-USDT')}`,
        mexc: `https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`,
        gateio: `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol.replace('USDT', '_USDT')}`,
      };
      const results = {};
      await Promise.all(
        Object.entries(sources).map(async ([name, srcUrl]) => {
          try {
            const res = await fetch(srcUrl);
            const body = await res.text();
            results[name] = { status: res.status, body: body.slice(0, 120) };
          } catch (err) {
            results[name] = { error: String(err).slice(0, 120) };
          }
        })
      );
      return json({ ok: true, results });
    }

    // Telegram webhook. The only thing it reacts to is someone typing
    // "report 1D" (or 1W / 1M / ALL) in the channel — everything else is ignored.
    // Register it once with:
    //   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
    //     -d url="https://<worker-host>/telegram" \
    //     -d secret_token="<TELEGRAM_WEBHOOK_SECRET>" \
    //     -d allowed_updates='["message","channel_post"]'
    if (request.method === 'POST' && url.pathname === '/telegram') {
      const secret = (env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
      if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
        return json({ ok: false }, 403);
      }
      let update;
      try {
        update = await request.json();
      } catch {
        return json({ ok: true });
      }
      const msg = update?.channel_post ?? update?.message;
      const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
      const chatId = msg?.chat?.id;
      // "/report@thebot 1d" is accepted too — Telegram rewrites commands that way
      const match = /^\/?report(?:@\w+)?(?:\s+(\S+))?$/i.exec(text);
      if (!match || chatId === undefined) return json({ ok: true });
      const range = (match[1] ?? '').toUpperCase();

      // Telegram retries anything that is not a 200, so failures are answered, not thrown
      try {
        if (!REPORT_RANGES[range]) {
          await sendTelegram(env, chatId, 'Usage: report 1D · report 1W · report 1M · report ALL', msg.message_id);
          return json({ ok: true });
        }
        // The autopilot is keyed by the channel as it was configured: "@name" or the numeric id
        const names = msg.chat?.username ? [`@${msg.chat.username}`, String(chatId)] : [String(chatId)];
        let report = null;
        for (const name of names) {
          const res = await env.AUTOPILOT.get(env.AUTOPILOT.idFromName(name)).fetch(
            `https://do/report?range=${range}`
          );
          const body = await res.json();
          if (body?.ok) {
            report = body.text;
            break;
          }
        }
        await sendTelegram(env, chatId, report ?? 'No autopilot is configured for this channel yet.', msg.message_id);
      } catch (err) {
        console.log('report failed', { chatId, range, error: String(err) });
      }
      return json({ ok: true });
    }

    if (url.pathname === '/autopilot') {
      if (request.method === 'GET') {
        const channel = url.searchParams.get('channel');
        if (!channel) return json({ ok: false, error: 'channel required' }, 400);
        const stub = env.AUTOPILOT.get(env.AUTOPILOT.idFromName(normalizeChannel(channel)));
        return stub.fetch('https://do/status');
      }
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: 'invalid JSON' }, 400);
        }
        if (body?.action === 'reset' || body?.action === 'scan' || body?.action === 'close') {
          if (!body.channel || typeof body.channel !== 'string') return json({ ok: false, error: 'channel required' }, 400);
          if (body.action === 'close' && (typeof body.symbol !== 'string' || !Number.isFinite(Number(body.openedAt)))) {
            return json({ ok: false, error: 'symbol and openedAt required' }, 400);
          }
          const stub = env.AUTOPILOT.get(env.AUTOPILOT.idFromName(normalizeChannel(body.channel)));
          return stub.fetch(`https://do/${body.action}`, {
            method: 'POST',
            body: JSON.stringify({ symbol: body.symbol, openedAt: Number(body.openedAt) }),
          });
        }
        const { config, error } = validateAutopilotConfig(body);
        if (error) return json({ ok: false, error }, 400);
        const stub = env.AUTOPILOT.get(env.AUTOPILOT.idFromName(config.channel));
        return stub.fetch('https://do/configure', { method: 'POST', body: JSON.stringify(config) });
      }
      return json({ ok: false, error: 'GET or POST' }, 405);
    }

    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return json({ ok: false, error: 'POST /schedule only' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid JSON' }, 400);
    }

    // Two request shapes are accepted:
    //   current: { channel, text, delaySeconds? | targetPct?, trade?, replyToMessageId? }
    //   legacy:  { channel, text, delaySeconds? | profitTarget: { symbol, direction, entry, leverage, targetPct } }
    const { channel, text, delaySeconds, profitTarget, targetPct, trade, replyToMessageId } = body ?? {};
    if (!channel || typeof text !== 'string' || !text.trim() || text.length > 4096) {
      return json({ ok: false, error: 'bad request' }, 400);
    }
    const replyTo = Number.isInteger(replyToMessageId) && replyToMessageId > 0 ? replyToMessageId : undefined;

    const profitSpec = profitTarget ?? (targetPct !== undefined && trade ? { ...trade, targetPct } : null);

    let job;
    if (profitSpec) {
      const { symbol, direction, entry, leverage, targetPct } = profitSpec;
      const entryNum = Number(entry);
      const levNum = Number(leverage);
      const pctNum = Number(targetPct);
      if (
        typeof symbol !== 'string' ||
        !/^[A-Z0-9]{2,20}$/i.test(symbol) ||
        (direction !== 'Long' && direction !== 'Short') ||
        !Number.isFinite(entryNum) || entryNum <= 0 ||
        !Number.isFinite(levNum) || levNum < 1 || levNum > 125 ||
        !Number.isFinite(pctNum) || pctNum < 0.1 || pctNum > 100
      ) {
        return json({ ok: false, error: 'bad profitTarget' }, 400);
      }
      job = {
        mode: 'profit',
        chatId: normalizeChannel(channel),
        text: text.trim(),
        symbol: symbol.toUpperCase(),
        base: typeof trade?.base === 'string' && trade.base ? trade.base : undefined,
        direction,
        entry: entryNum,
        leverage: levNum,
        targetPct: pctNum,
        expiresAt: Date.now() + PROFIT_WATCH_MAX_MS,
        replyToMessageId: replyTo,
      };
    } else {
      const delay = Number(delaySeconds);
      if (!Number.isFinite(delay) || delay < 1 || delay > MAX_DELAY_SECONDS) {
        return json({ ok: false, error: 'bad request' }, 400);
      }
      job = {
        mode: 'time',
        chatId: normalizeChannel(channel),
        text: text.trim(),
        sendAt: Date.now() + delay * 1000,
        replyToMessageId: replyTo,
      };
    }

    const stub = env.CLOSE_SCHEDULER.get(env.CLOSE_SCHEDULER.newUniqueId());
    await stub.fetch('https://do/schedule', { method: 'POST', body: JSON.stringify(job) });
    return json({ ok: true, mode: job.mode });
  },
};

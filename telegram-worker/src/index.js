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
const AUTOPILOT_CLOSE_RETRIES = 3;
const AUTOPILOT_TIMEFRAMES = ['1m', '5m', '15m', '30m', '45m', '1h', '4h', '1d'];

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
  if (reason === 'stop') return `🛑 Stop loss hit: ${signed(pnlPct)}`;
  if (reason === 'expired') return `⏱ Closed after 24h: ${signed(pnlPct)}`;
  return `✅ Closed with ${signed(pnlPct)} profit`;
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
      return this.reset();
    }
    return json({ ok: false, error: 'not found' }, 404);
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
        const price = await fetchPrice(trade.symbol);
        const pnlPct = price === null ? null : leveragedPnlPct(trade.direction, trade.entry, trade.leverage, price);
        try {
          await postClose(this.env, chatId, trade.base, pnlPct, 'manual', trade.messageId);
        } catch (err) {
          failures.push(`${trade.base}: ${String(err)}`);
        }
      }
    }
    await this.state.storage.put('trades', { open: [], recent: [] });
    await this.state.storage.delete(['lastScan', 'lastScanAt']);
    await this.state.storage.put('lastError', failures.length ? `reset: ${failures.join('; ')}` : null);
    if (config?.enabled) {
      await this.state.storage.setAlarm(Date.now() + 1_000);
    }
    return json({ ok: true, status: await this.status() });
  }

  async status() {
    const [config, trades, lastScanAt, lastError, lastScan] = await Promise.all([
      this.state.storage.get('config'),
      this.state.storage.get('trades'),
      this.state.storage.get('lastScanAt'),
      this.state.storage.get('lastError'),
      this.state.storage.get('lastScan'),
    ]);
    return {
      config: config ?? null,
      openTrades: trades?.open ?? [],
      recentTrades: trades?.recent ?? [],
      lastScanAt: lastScanAt ?? null,
      lastError: lastError ?? null,
      lastScan: lastScan ?? null,
    };
  }

  async configure(config) {
    await this.state.storage.put('config', { ...config, updatedAt: Date.now() });
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

  async alarm() {
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
    for (const trade of trades.open) {
      const price = await fetchPrice(trade.symbol);
      if (price === null) {
        stillOpen.push(trade);
        continue;
      }
      const pnlPct = leveragedPnlPct(trade.direction, trade.entry, trade.leverage, price);
      const stopHit =
        trade.direction === 'Long' ? price <= trade.stopLoss : price >= trade.stopLoss;
      let reason = null;
      if (pnlPct >= trade.targetPct) reason = 'profit';
      else if (stopHit) reason = 'stop';
      else if (Date.now() - trade.openedAt > AUTOPILOT_MAX_HOLD_MS) reason = 'expired';

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
      trades.recent.unshift({ ...trade, closedAt: Date.now(), exitPrice: price, pnlPct, reason });
    }
    trades.open = stillOpen;
    trades.recent = trades.recent.slice(0, AUTOPILOT_RECENT_KEPT);
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
        if (plan.direction === 'Neutral' || plan.riskLevel !== 'Low') {
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
}

// ---------- HTTP entry ----------

const validateAutopilotConfig = (body) => {
  const { channel, enabled, coins, timeframe, targetPct } = body ?? {};
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
  return {
    config: { channel: normalizeChannel(channel), enabled, coins: cleanCoins, timeframe, targetPct: pct },
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
        if (body?.action === 'reset') {
          if (!body.channel || typeof body.channel !== 'string') return json({ ok: false, error: 'channel required' }, 400);
          const stub = env.AUTOPILOT.get(env.AUTOPILOT.idFromName(normalizeChannel(body.channel)));
          return stub.fetch('https://do/reset', { method: 'POST' });
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

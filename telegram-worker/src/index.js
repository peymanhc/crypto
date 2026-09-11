// Schedules an automatic "CLOSE $COIN" Telegram message that fires even after
// the visitor closes their browser. Two modes, each job one Durable Object:
//   - time mode:   send after a fixed delay (one candle of the timeframe)
//   - profit mode: poll the Binance price every 3s and send once the leveraged
//                  PnL reaches the target percentage (watch expires after 24h)

const MAX_DELAY_SECONDS = 2 * 86_400; // 2 days is plenty for a 1d candle
const PROFIT_POLL_MS = 3_000;
const PROFIT_WATCH_MAX_MS = 24 * 3_600_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });

// "✅ Closed with +2.35% profit" — leveraged PnL only, deliberately without the token
const formatProfitMessage = (pnlPct) => `✅ Closed with +${pnlPct.toFixed(2)}% profit`;

// Accept "@name", "name", a t.me link, or a numeric -100... id
const normalizeChannel = (channel) => {
  const bare = String(channel).trim().replace(/^https?:\/\/t\.me\//i, '');
  return /^-?\d+$/.test(bare) ? bare : bare.startsWith('@') ? bare : `@${bare}`;
};

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

  // Binance blocks Cloudflare Workers egress IPs entirely (403, even on
  // data-api.binance.vision), so the watch uses MEXC (identical API shape and
  // symbol format, near-identical spot prices) with Bybit as fallback.
  async fetchPrice(symbol) {
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
      const res = await fetch(
        `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`
      );
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data?.result?.list?.[0]?.lastPrice);
        if (Number.isFinite(price)) return price;
      }
    } catch {
      // both sources failed this round; caller reschedules
    }
    return null;
  }

  // replyToMessageId threads the CLOSE under the original signal post
  async sendTelegram(chatId, text, replyToMessageId) {
    const token = (this.env.TELEGRAM_BOT_TOKEN ?? '').trim();
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
          const price = await this.fetchPrice(job.symbol);
          if (price !== null) {
            const dir = job.direction === 'Long' ? 1 : -1;
            const pnlPct = ((price - job.entry) / job.entry) * 100 * job.leverage * dir;
            if (pnlPct >= job.targetPct) {
              console.log('profit target hit', { symbol: job.symbol, price, pnlPct: pnlPct.toFixed(3) });
              // The reply sits under the signal post, so the coin is already clear —
              // report only the result, no token name
              await this.sendTelegram(job.chatId, formatProfitMessage(pnlPct), job.replyToMessageId);
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
      await this.sendTelegram(job.chatId, job.text, job.replyToMessageId);
    } catch (err) {
      console.log('alarm error', String(err));
    }
    // Always clean up — a failed send should not retry forever
    await this.state.storage.deleteAll();
  }
}

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

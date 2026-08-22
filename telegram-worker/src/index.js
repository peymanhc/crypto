// Schedules a delayed Telegram message (e.g. an automatic "CLOSE $BTC") that
// fires even after the visitor closes their browser. Each scheduled job is one
// Durable Object whose alarm posts the message and then cleans itself up.

const MAX_DELAY_SECONDS = 2 * 86_400; // 2 days is plenty for a 1d candle

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
    const { chatId, text, sendAt } = await request.json();
    await this.state.storage.put('job', { chatId, text });
    await this.state.storage.setAlarm(sendAt);
    return json({ ok: true });
  }

  async alarm() {
    const job = await this.state.storage.get('job');
    if (job) {
      await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: job.chatId, text: job.text }),
      });
    }
    await this.state.storage.deleteAll();
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return json({ ok: false, error: 'POST /schedule only' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid JSON' }, 400);
    }

    const { channel, text, delaySeconds } = body ?? {};
    const delay = Number(delaySeconds);
    if (
      !channel ||
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 4096 ||
      !Number.isFinite(delay) ||
      delay < 1 ||
      delay > MAX_DELAY_SECONDS
    ) {
      return json({ ok: false, error: 'bad request' }, 400);
    }

    const stub = env.CLOSE_SCHEDULER.get(env.CLOSE_SCHEDULER.newUniqueId());
    await stub.fetch('https://do/schedule', {
      method: 'POST',
      body: JSON.stringify({
        chatId: normalizeChannel(channel),
        text: text.trim(),
        sendAt: Date.now() + delay * 1000,
      }),
    });
    return json({ ok: true, scheduledInSeconds: delay });
  },
};

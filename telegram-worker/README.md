# Telegram auto-close scheduler (Cloudflare Worker)

Lets the app schedule an automatic `CLOSE $COIN` message that is posted to the
user's Telegram channel after one candle of the selected timeframe — **even if
the visitor closes their browser**. The browser only registers the job; this
Worker holds the timer (a Durable Object alarm) and posts the message itself.

Runs on Cloudflare's free plan.

## Deploy (one time)

```bash
cd telegram-worker
npx wrangler login                       # opens browser to log in to Cloudflare
npx wrangler secret put TELEGRAM_BOT_TOKEN   # paste the @SignalPHC_bot token
npx wrangler deploy                      # prints the worker URL
```

Then put the printed URL in the app's `.env.local` and rebuild:

```
VITE_TELEGRAM_WORKER_URL=https://crypto-signal-scheduler.<your-subdomain>.workers.dev
```

The "Auto-close after 1 candle" checkbox in the signal card only appears when
this URL is configured.

## API

`POST /schedule` with JSON `{ "channel": "@name", "text": "CLOSE $BTC", "delaySeconds": 60 }`
→ `{ "ok": true, "scheduledInSeconds": 60 }`. Max delay: 2 days.

## Local test

```bash
echo 'TELEGRAM_BOT_TOKEN=dummy' > .dev.vars
npx wrangler dev
curl -X POST http://localhost:8787/schedule \
  -H 'content-type: application/json' \
  -d '{"channel":"@test","text":"CLOSE $BTC","delaySeconds":5}'
```

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MAX_DELAY_SECONDS = 2 * 86400;
var PROFIT_POLL_MS = 3e3;
var PROFIT_WATCH_MAX_MS = 24 * 36e5;
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, "content-type": "application/json" }
}), "json");
var normalizeChannel = /* @__PURE__ */ __name((channel) => {
  const bare = String(channel).trim().replace(/^https?:\/\/t\.me\//i, "");
  return /^-?\d+$/.test(bare) ? bare : bare.startsWith("@") ? bare : `@${bare}`;
}, "normalizeChannel");
var CloseScheduler = class {
  static {
    __name(this, "CloseScheduler");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const job = await request.json();
    await this.state.storage.put("job", job);
    const firstAlarm = job.mode === "profit" ? Date.now() + PROFIT_POLL_MS : job.sendAt;
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
    }
    return null;
  }
  async sendTelegram(chatId, text) {
    const token = (this.env.TELEGRAM_BOT_TOKEN ?? "").trim();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const body = await response.text();
    console.log("telegram send", { chatId, status: response.status, body: body.slice(0, 300) });
  }
  async alarm() {
    const job = await this.state.storage.get("job");
    if (!job) {
      await this.state.storage.deleteAll();
      return;
    }
    if (job.mode === "profit") {
      try {
        if (Date.now() < job.expiresAt) {
          const price = await this.fetchPrice(job.symbol);
          if (price !== null) {
            const dir = job.direction === "Long" ? 1 : -1;
            const pnlPct = (price - job.entry) / job.entry * 100 * job.leverage * dir;
            if (pnlPct >= job.targetPct) {
              console.log("profit target hit", { symbol: job.symbol, price, pnlPct: pnlPct.toFixed(3) });
              await this.sendTelegram(job.chatId, job.text);
              await this.state.storage.deleteAll();
              return;
            }
          } else {
            console.log("price fetch failed", { symbol: job.symbol });
          }
          await this.state.storage.setAlarm(Date.now() + PROFIT_POLL_MS);
          return;
        }
        console.log("profit watch expired", { symbol: job.symbol });
      } catch (err) {
        console.log("profit watch error", String(err));
        await this.state.storage.setAlarm(Date.now() + PROFIT_POLL_MS);
        return;
      }
      await this.state.storage.deleteAll();
      return;
    }
    try {
      await this.sendTelegram(job.chatId, job.text);
    } catch (err) {
      console.log("alarm error", String(err));
    }
    await this.state.storage.deleteAll();
  }
};
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const symbol = (url.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
      const sources = {
        binanceVision: `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`,
        bybit: `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`,
        okx: `https://www.okx.com/api/v5/market/ticker?instId=${symbol.replace("USDT", "-USDT")}`,
        kucoin: `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol.replace("USDT", "-USDT")}`,
        mexc: `https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`,
        gateio: `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol.replace("USDT", "_USDT")}`
      };
      const results = {};
      await Promise.all(
        Object.entries(sources).map(async ([name, srcUrl]) => {
          try {
            const res = await fetch(srcUrl);
            const body2 = await res.text();
            results[name] = { status: res.status, body: body2.slice(0, 120) };
          } catch (err) {
            results[name] = { error: String(err).slice(0, 120) };
          }
        })
      );
      return json({ ok: true, results });
    }
    if (request.method !== "POST" || url.pathname !== "/schedule") {
      return json({ ok: false, error: "POST /schedule only" }, 404);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid JSON" }, 400);
    }
    const { channel, text, delaySeconds, profitTarget } = body ?? {};
    if (!channel || typeof text !== "string" || !text.trim() || text.length > 4096) {
      return json({ ok: false, error: "bad request" }, 400);
    }
    let job;
    if (profitTarget) {
      const { symbol, direction, entry, leverage, targetPct } = profitTarget;
      const entryNum = Number(entry);
      const levNum = Number(leverage);
      const pctNum = Number(targetPct);
      if (typeof symbol !== "string" || !/^[A-Z0-9]{2,20}$/i.test(symbol) || direction !== "Long" && direction !== "Short" || !Number.isFinite(entryNum) || entryNum <= 0 || !Number.isFinite(levNum) || levNum < 1 || levNum > 125 || !Number.isFinite(pctNum) || pctNum < 0.1 || pctNum > 100) {
        return json({ ok: false, error: "bad profitTarget" }, 400);
      }
      job = {
        mode: "profit",
        chatId: normalizeChannel(channel),
        text: text.trim(),
        symbol: symbol.toUpperCase(),
        direction,
        entry: entryNum,
        leverage: levNum,
        targetPct: pctNum,
        expiresAt: Date.now() + PROFIT_WATCH_MAX_MS
      };
    } else {
      const delay = Number(delaySeconds);
      if (!Number.isFinite(delay) || delay < 1 || delay > MAX_DELAY_SECONDS) {
        return json({ ok: false, error: "bad request" }, 400);
      }
      job = {
        mode: "time",
        chatId: normalizeChannel(channel),
        text: text.trim(),
        sendAt: Date.now() + delay * 1e3
      };
    }
    const stub = env.CLOSE_SCHEDULER.get(env.CLOSE_SCHEDULER.newUniqueId());
    await stub.fetch("https://do/schedule", { method: "POST", body: JSON.stringify(job) });
    return json({ ok: true, mode: job.mode });
  }
};

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Q2FUhv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Q2FUhv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  CloseScheduler,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

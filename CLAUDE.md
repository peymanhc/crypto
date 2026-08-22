# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A single-page crypto technical-analysis app ("Coin Analysis"): React 18 + TypeScript + Vite + Tailwind CSS. The user picks a trading pair and timeframe, the app fetches OHLCV candles from the public Binance REST API (no API key), computes indicators client-side (SMA 10/50, support/resistance, trend, engulfing price-action patterns, Ichimoku), and renders a trade signal. Deployed to GitHub Pages at `/crypto` (`base: "/crypto"` in `vite.config.ts`).

## Commands

npm only (`package-lock.json`).

```
npm install
npm run dev       # Vite dev server
npm run build     # vite build only — does NOT run tsc, so type errors won't fail the build
npm run lint      # eslint . (ESLint 9 flat config)
npm run preview
npm run deploy    # gh-pages -d dist (predeploy builds first)
```

There is no test infrastructure (no test runner, no test files) and no CI. To type-check, run `npx tsc -b` manually.

## Architecture

The data path is: `App.tsx` (all state) → `TradingForm.tsx` (pair/timeframe form) → `src/services/api.ts` (Binance klines fetch + all indicator math) → `Result.tsx` (single-timeframe signal) and `MultiTimeframeAdvice.tsx` (Long/Short/Neutral per timeframe with a two-line reason). Types live in `src/types/trading.ts`; the pair/timeframe lists in `src/constants/trading.ts`.

All strategy logic is centralized in `analyzeCandles()` in `src/services/api.ts`: it scores 5 checks (SMA 10/50 alignment, price vs Ichimoku cloud, Tenkan vs Kijun, Chikou comparison, engulfing pattern — evaluated on the last *closed* candle, not the forming one) and requires |score| ≥ 2 for a Long/Short call. Exhaustion filters then veto the call to Neutral (with a `caution` note in the reason) when RSI is overbought/oversold or price is stretched >2×ATR from SMA10 — without these, low-timeframe signals fire exactly at reversal points. Both `fetchTradingStrategy()` (main result, selected timeframe) and `fetchMultiTimeframeAdvice()` (fixed set in `ADVICE_TIMEFRAMES`) go through it — change signal logic there, in one place.

`buildTradePlan()` (same file) turns an analysis into the SignalCard trade plan: risk unit R = 1.5×ATR(14) (never the raw 20-candle range edge — that produced absurd 17%+ targets on high timeframes), SL at 1R, TPs laddered at 1R/2R/3R/4R (count scales with confluence strength, 2–4), leverage tiered down as stop distance widens (capped at 3x on weak confluence), plus a Low/Medium/High risk level.

`fetchCandlesForTimeframe()` supports a synthetic 45m interval (Binance has none) by aggregating three aligned 15m candles (`aggregateCandles`).

Dependencies `ccxt`, `talib`, and `lightweight-charts` are declared in package.json but unused (leftovers from a removed parallel implementation).

## Gotchas

- Ichimoku cloud values for the *current* candle must come from spans computed 26 candles back (the forward displacement) — `calculateIchimoku()` does this; don't "simplify" it to same-index spans.
- UI copy is English, but the user-facing error message in `src/App.tsx` is Persian.
- The Binance base URL is hardcoded in `src/services/api.ts`; there is no env config anywhere.
- No Prettier; match surrounding formatting manually.

import { useEffect, useRef, useState } from 'react';
import { RiskLevel } from '../types/trading';
import { AutoTradeConfig, AutoTradeScanResult, HlSession, HlSettings, HlTradeLogEntry } from '../types/hyperliquid';
import { analyzeCandles, buildTradePlan, timeframeMs, baseAsset } from '../lib/analysis';
import { fetchBacktestCandles } from '../lib/backtestData';
import { readAccount, openFromPlan } from '../lib/hyperliquid/orders';
import { loadAutoConfig, saveAutoConfig } from '../lib/hyperliquid/session';
import { loadWindows, activeWindow } from '../lib/tradeWindows';

// Same rhythm as the Worker's autopilot: look for signals every 5 minutes,
// analyse the latest 200 candles, wait one candle (min 30 min) before re-entering a coin
const SCAN_MS = 5 * 60_000;
const CANDLES = 200;
const MIN_COOLDOWN_MS = 30 * 60_000;

interface Deps {
  session: HlSession | null;
  settings: HlSettings;
  log: (entry: Omit<HlTradeLogEntry, 'at'>) => void;
  onOpened: () => void;
}

// Runs the untouched dashboard analysis on a watchlist and opens the signals on Hyperliquid.
// Works only while this page is open; TP / SL orders live on the exchange and close on their own.
export const useAutoTrader = ({ session, settings, log, onOpened }: Deps) => {
  const [config, setConfig] = useState<AutoTradeConfig>(loadAutoConfig);
  const [lastScan, setLastScan] = useState<{ at: number; results: AutoTradeScanResult[] } | null>(null);
  const [scanning, setScanning] = useState(false);
  const lastOpened = useRef<Record<string, number>>({});
  // Latest values for the interval callback
  const latest = useRef({ session, settings, config });
  latest.current = { session, settings, config };

  const update = (next: Partial<AutoTradeConfig>) => {
    const merged = { ...config, ...next };
    setConfig(merged);
    saveAutoConfig(merged);
  };

  const scanCoin = async (coin: string, openCoins: Set<string>): Promise<AutoTradeScanResult> => {
    const { session: s, settings: st, config: c } = latest.current;
    if (!s) return { coin, status: 'error', error: 'no-session' };
    const base = baseAsset(coin);
    if (openCoins.has(base)) return { coin, status: 'position-open' };
    const cooldown = Math.max(timeframeMs(c.timeframe), MIN_COOLDOWN_MS);
    if (Date.now() - (lastOpened.current[base] ?? 0) < cooldown) return { coin, status: 'position-open' };
    try {
      const candles = await fetchBacktestCandles(coin, c.timeframe, CANDLES);
      const plan = buildTradePlan(analyzeCandles(candles));
      const found = { coin, direction: plan.direction, riskLevel: plan.riskLevel };
      if (plan.direction === 'Neutral') return { ...found, status: 'no-signal' };
      if (!c.riskLevels.includes(plan.riskLevel)) return { ...found, status: 'risk-filtered' };
      const opened = await openFromPlan(s, st, coin, plan);
      lastOpened.current[base] = Date.now();
      log({ kind: 'open', coin: base, direction: plan.direction, size: opened.size, price: opened.avgPx, leverage: opened.leverage, plan });
      onOpened();
      return { ...found, status: 'opened' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log({ kind: 'error', coin: base, message });
      return { coin, status: 'error', error: message };
    }
  };

  const scan = async () => {
    const { session: s, config: c } = latest.current;
    if (!s || scanning) return;
    // Inside a no-trade window (Dashboard card) nothing new is opened
    if (activeWindow(loadWindows())) {
      setLastScan({ at: Date.now(), results: c.coins.map((coin) => ({ coin, status: 'paused' as const })) });
      return;
    }
    setScanning(true);
    try {
      const account = await readAccount(s);
      const openCoins = new Set(account.positions.map((p) => p.coin));
      const results: AutoTradeScanResult[] = [];
      for (const coin of c.coins) results.push(await scanCoin(coin, openCoins));
      setLastScan({ at: Date.now(), results });
    } catch (err) {
      setLastScan({ at: Date.now(), results: [{ coin: '*', status: 'error', error: err instanceof Error ? err.message : String(err) }] });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!config.enabled || !session) return;
    scan();
    const id = setInterval(scan, SCAN_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, session]);

  const toggleRisk = (level: RiskLevel, on: boolean) => {
    const order: RiskLevel[] = ['Low', 'Medium', 'High'];
    const next = on ? [...config.riskLevels, level] : config.riskLevels.filter((l) => l !== level);
    update({ riskLevels: order.filter((l) => next.includes(l)) });
  };

  return { config, update, toggleRisk, lastScan, scanning, scanNow: scan };
};

import { useEffect, useRef, useState } from 'react';
import { RiskLevel } from '../types/trading';
import { AutoTradeConfig, AutoTradeScanResult, HlSession, HlSettings, HlTradeLogEntry } from '../types/hyperliquid';
import { analyzeCandles, buildTradePlan, timeframeMs, baseAsset } from '../lib/analysis';
import { fetchBacktestCandles } from '../lib/backtestData';
import { readAccount, openFromPlan } from '../lib/hyperliquid/orders';
import { fetchPumpCandidates, pumpShortPlan, PUMP_COOLDOWN_MS, PUMP_MIN_DAY_VOLUME_USD } from '../lib/hyperliquid/pumps';
import { loadAutoConfig, saveAutoConfig } from '../lib/hyperliquid/session';
import { loadWindows, activeWindow } from '../lib/tradeWindows';

// Same rhythm as the Worker's autopilot: signals every 5 minutes on the latest 200 candles,
// pump shorts every 30 minutes, one candle (min 30 min) before re-entering a coin
const SCAN_MS = 5 * 60_000;
const PUMP_SCAN_MS = 30 * 60_000;
const CANDLES = 200;
const MIN_COOLDOWN_MS = 30 * 60_000;

interface Deps {
  session: HlSession | null;
  settings: HlSettings;
  log: (entry: Omit<HlTradeLogEntry, 'at'>) => void;
  onOpened: () => void;
}

export interface ScanSnapshot {
  at: number;
  results: AutoTradeScanResult[];
  pumps: AutoTradeScanResult[] | null;
}

export const useAutoTrader = ({ session, settings, log, onOpened }: Deps) => {
  const [config, setConfig] = useState<AutoTradeConfig>(loadAutoConfig);
  const [lastScan, setLastScan] = useState<ScanSnapshot | null>(null);
  const [scanning, setScanning] = useState(false);
  const lastOpened = useRef<Record<string, number>>({});
  const lastPumpScan = useRef(0);
  // Latest values for the interval callback
  const latest = useRef({ session, settings, config });
  latest.current = { session, settings, config };

  const update = (next: Partial<AutoTradeConfig>) => {
    const merged = { ...config, ...next };
    setConfig(merged);
    saveAutoConfig(merged);
  };

  // Shared state of one scan: how many positions exist right now
  interface Slots {
    open: Set<string>;
    count: number;
  }

  const roomLeft = (slots: Slots) => slots.count < Math.max(1, latest.current.config.maxOpen);

  const scanCoin = async (coin: string, slots: Slots): Promise<AutoTradeScanResult> => {
    const { session: s, settings: st, config: c } = latest.current;
    if (!s) return { coin, status: 'error', error: 'no-session' };
    const base = baseAsset(coin);
    if (slots.open.has(base)) return { coin, status: 'position-open' };
    const cooldown = Math.max(timeframeMs(c.timeframe), MIN_COOLDOWN_MS);
    if (Date.now() - (lastOpened.current[base] ?? 0) < cooldown) return { coin, status: 'cooldown' };
    try {
      const candles = await fetchBacktestCandles(coin, c.timeframe, CANDLES);
      const plan = buildTradePlan(analyzeCandles(candles));
      const found = { coin, direction: plan.direction, riskLevel: plan.riskLevel };
      if (plan.direction === 'Neutral') return { ...found, status: 'no-signal' };
      if (!c.riskLevels.includes(plan.riskLevel)) return { ...found, status: 'risk-filtered' };
      if (!roomLeft(slots)) return { ...found, status: 'max-open' };
      const opened = await openFromPlan(s, st, coin, plan);
      lastOpened.current[base] = Date.now();
      slots.open.add(base);
      slots.count += 1;
      log({ kind: 'open', coin: base, direction: plan.direction, size: opened.size, price: opened.avgPx, leverage: opened.leverage, plan });
      onOpened();
      return { ...found, status: 'opened' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log({ kind: 'error', coin: base, message });
      return { coin, status: 'error', error: message };
    }
  };

  const scanPumps = async (slots: Slots): Promise<AutoTradeScanResult[]> => {
    const { session: s, settings: st, config: c } = latest.current;
    if (!s) return [];
    const results: AutoTradeScanResult[] = [];
    let markets;
    try {
      markets = await fetchPumpCandidates(s.network);
    } catch (err) {
      return [{ coin: '*', status: 'error', error: err instanceof Error ? err.message : String(err) }];
    }
    for (const market of markets) {
      if (market.changePct < c.hlPumpPct || market.volume < PUMP_MIN_DAY_VOLUME_USD) continue;
      const found = { coin: market.coin, changePct: market.changePct, direction: 'Short' as const };
      if (slots.open.has(market.coin)) {
        results.push({ ...found, status: 'position-open' });
        continue;
      }
      if (Date.now() - (lastOpened.current[market.coin] ?? 0) < PUMP_COOLDOWN_MS) {
        results.push({ ...found, status: 'cooldown' });
        continue;
      }
      if (!roomLeft(slots)) {
        results.push({ ...found, status: 'max-open' });
        continue;
      }
      try {
        const plan = pumpShortPlan(market);
        const opened = await openFromPlan(s, st, market.coin, plan, { takeProfit: 'tpFinal' });
        lastOpened.current[market.coin] = Date.now();
        slots.open.add(market.coin);
        slots.count += 1;
        log({ kind: 'open', coin: market.coin, direction: 'Short', size: opened.size, price: opened.avgPx, leverage: opened.leverage, plan });
        onOpened();
        results.push({ ...found, status: 'opened' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log({ kind: 'error', coin: market.coin, message });
        results.push({ ...found, status: 'error', error: message });
      }
    }
    return results;
  };

  const scan = async () => {
    const { session: s, config: c } = latest.current;
    if (!s || scanning) return;
    // Inside a no-trade window (Dashboard card) nothing new is opened
    if (activeWindow(loadWindows())) {
      setLastScan({ at: Date.now(), results: c.coins.map((coin) => ({ coin, status: 'paused' as const })), pumps: null });
      return;
    }
    setScanning(true);
    try {
      const account = await readAccount(s);
      const slots: Slots = { open: new Set(account.positions.map((p) => p.coin)), count: account.positions.length };
      const results: AutoTradeScanResult[] = [];
      for (const coin of c.coins) results.push(await scanCoin(coin, slots));
      let pumps: AutoTradeScanResult[] | null = null;
      if (c.hlPumpShort && Date.now() - lastPumpScan.current >= PUMP_SCAN_MS) {
        lastPumpScan.current = Date.now();
        pumps = await scanPumps(slots);
      }
      setLastScan((prev) => ({ at: Date.now(), results, pumps: pumps ?? prev?.pumps ?? null }));
    } catch (err) {
      setLastScan({ at: Date.now(), results: [{ coin: '*', status: 'error', error: err instanceof Error ? err.message : String(err) }], pumps: null });
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

  // "Scan now" also forces a fresh pump check
  const scanNow = () => {
    lastPumpScan.current = 0;
    return scan();
  };

  return { config, update, toggleRisk, lastScan, scanning, scanNow };
};

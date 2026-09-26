// Login details and settings, kept in localStorage.
import { AutoTradeConfig, HlSession, HlSettings, HlTradeLogEntry } from '../../types/hyperliquid';

const KEYS = { session: 'hl-session', settings: 'hl-settings', auto: 'hl-auto-trade', log: 'hl-trade-log' };
const LOG_KEPT = 100;

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
};

export const DEFAULT_SETTINGS: HlSettings = { marginUsd: 20, maxLeverage: 5, isCross: true, takeProfit: 'tp1', slippagePct: 1 };
export const DEFAULT_AUTO: AutoTradeConfig = { enabled: false, coins: ['BTC/USDT'], timeframe: '15m', riskLevels: ['Low'] };

export const loadSession = (): HlSession | null => read<HlSession | null>(KEYS.session, null);
export const saveSession = (session: HlSession | null) => {
  if (session) write(KEYS.session, session);
  else localStorage.removeItem(KEYS.session);
};

export const loadSettings = (): HlSettings => ({ ...DEFAULT_SETTINGS, ...read<Partial<HlSettings>>(KEYS.settings, {}) });
export const saveSettings = (settings: HlSettings) => write(KEYS.settings, settings);

export const loadAutoConfig = (): AutoTradeConfig => ({ ...DEFAULT_AUTO, ...read<Partial<AutoTradeConfig>>(KEYS.auto, {}), enabled: false });
export const saveAutoConfig = (config: AutoTradeConfig) => write(KEYS.auto, config);

export const loadLog = (): HlTradeLogEntry[] => read<HlTradeLogEntry[]>(KEYS.log, []);
export const appendLog = (entry: HlTradeLogEntry): HlTradeLogEntry[] => {
  const next = [entry, ...loadLog()].slice(0, LOG_KEPT);
  write(KEYS.log, next);
  return next;
};

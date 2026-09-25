// Everything the strategy tabs remember between visits, in localStorage.
import { CustomStrategy, EngineId, SimpleSelection } from '../../types/strategy';
import { EngineInputs } from './engine';
import { PRESET_IDS } from './presets';

const KEYS = {
  engine: 'signal-engine',
  simple: 'simple-strategies',
  pro: 'pro-strategies',
  proActive: 'pro-active-strategy',
};

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
    // storage unavailable — settings live for this session only
  }
};

export const DEFAULT_SIMPLE: SimpleSelection = { enabled: ['ichimoku', 'smaTrend'], minAgree: 1 };

export const loadEngine = (): EngineId => {
  const value = read<EngineId>(KEYS.engine, 'dashboard');
  return value === 'simple' || value === 'pro' ? value : 'dashboard';
};
export const saveEngine = (engine: EngineId) => write(KEYS.engine, engine);

export const loadSimple = (): SimpleSelection => {
  const stored = read<Partial<SimpleSelection>>(KEYS.simple, {});
  const enabled = Array.isArray(stored.enabled) ? stored.enabled.filter((id) => PRESET_IDS.includes(id)) : DEFAULT_SIMPLE.enabled;
  const minAgree = Number.isFinite(stored.minAgree) ? Math.max(1, Number(stored.minAgree)) : DEFAULT_SIMPLE.minAgree;
  return { enabled, minAgree };
};
export const saveSimple = (selection: SimpleSelection) => write(KEYS.simple, selection);

export const loadStrategies = (): CustomStrategy[] => {
  const list = read<CustomStrategy[]>(KEYS.pro, []);
  return Array.isArray(list) ? list.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.rules)) : [];
};
export const saveStrategies = (list: CustomStrategy[]) => write(KEYS.pro, list);

export const loadActiveStrategyId = (): string | null => read<string | null>(KEYS.proActive, null);
export const saveActiveStrategyId = (id: string | null) => write(KEYS.proActive, id);

// Everything the engine needs, straight from storage (used by the backtest)
export const loadEngineInputs = (): EngineInputs => {
  const strategies = loadStrategies();
  const activeId = loadActiveStrategyId();
  return {
    engine: loadEngine(),
    simple: loadSimple(),
    pro: strategies.find((s) => s.id === activeId) ?? strategies[0] ?? null,
  };
};

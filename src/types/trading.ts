export interface IchimokuValues {
  tenkanSen: number | null;
  kijunSen: number | null;
  senkouSpanA: number | null;
  senkouSpanB: number | null;
  chikouSpan: number | null;
}

export type Recommendation = 'Long' | 'Short' | 'Neutral';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface TradePlan {
  direction: Recommendation;
  riskLevel: RiskLevel;
  leverage: number;
  entry: number;
  takeProfits: number[];
  stopLoss: number;
  score: number;
}

export interface TradingResult {
  currentPrice: number;
  smaShort: number;
  smaLong: number;
  signal: string;
  resistance: number;
  support: number;
  priceActionSignal?: string;
  trend?: string;
  ichimokuValues?: IchimokuValues;
  plan?: TradePlan;
}

// A CME Bitcoin futures weekend gap: Friday 17:00 ET close -> Sunday 18:00 ET open
export interface CmeGap {
  openedAt: number;
  from: number;
  to: number;
  sizePct: number;
  filled: boolean;
  filledAt?: number;
}

export interface TimeframeAdvice {
  timeframe: string;
  label: string;
  recommendation: Recommendation;
  reason: string;
  gaps?: CmeGap[];
}

export interface MultiTimeframeResult {
  advices: TimeframeAdvice[];
  cmeGaps: CmeGap[];
}

export interface TradingFormData {
  symbol: string;
  timeframe: string;
}

// ---------- Autopilot (server-side, runs in the Cloudflare Worker) ----------

export interface AutopilotConfig {
  enabled: boolean;
  channel: string;
  // "BASE/QUOTE" pairs, at most 4
  coins: string[];
  timeframe: string;
  // Leveraged profit % at which the Worker posts CLOSE $COIN
  targetPct: number;
  // Only signals whose plan risk level is in this list are posted (default: Low only)
  riskLevels: RiskLevel[];
  // Every 30 min, short (4x) any Hyperliquid perp up more than 150% in 24h
  hlPumpShort?: boolean;
  updatedAt?: number;
}

export type AutopilotCloseReason = 'profit' | 'stop' | 'expired' | 'manual';

export interface AutopilotTrade {
  symbol: string;
  base: string;
  venue?: 'hyperliquid';
  strategy?: string;
  direction: Recommendation;
  entry: number;
  leverage: number;
  stopLoss: number;
  targetPct: number;
  openedAt: number;
  messageId: number | null;
  closedAt?: number;
  exitPrice?: number;
  pnlPct?: number;
  reason?: AutopilotCloseReason;
}

export type AutopilotScanOutcome = 'posted' | 'no-signal' | 'open' | 'cooldown' | 'error';

// What the Worker concluded for one coin in its latest scan
export interface AutopilotScanResult {
  coin: string;
  status: AutopilotScanOutcome;
  direction?: Recommendation;
  riskLevel?: RiskLevel;
  score?: number;
  error?: string;
}

export interface AutopilotStatus {
  config: AutopilotConfig | null;
  openTrades: AutopilotTrade[];
  recentTrades: AutopilotTrade[];
  lastScanAt: number | null;
  lastError: string | null;
  lastScan?: { at: number; results: AutopilotScanResult[] } | null;
  lastHlScan?: {
    at: number;
    checked: number;
    pumps: { coin: string; changePct: number; status: 'posted' | 'open' | 'cooldown' | 'low-volume' | 'error'; error?: string }[];
    error?: string;
  } | null;
}

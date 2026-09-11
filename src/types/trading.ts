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

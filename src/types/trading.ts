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

export interface TimeframeAdvice {
  timeframe: string;
  label: string;
  recommendation: Recommendation;
  reason: string;
}

export interface TradingFormData {
  symbol: string;
  timeframe: string;
}

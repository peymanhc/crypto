export interface TradingResult {
  currentPrice: number;
  smaShort: number;
  smaLong: number;
  signal: string;
}

export interface TradingFormData {
  symbol: string;
  timeframe: string;
}
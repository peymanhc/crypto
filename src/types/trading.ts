export interface TradingResult {
  currentPrice: number;
  smaShort: number;
  smaLong: number;
  signal: string;
  resistance:number;
  support:number;
  priceActionSignal?:string;
  trend?:string;
  fibonacciLevels?:{
    level0: number;
    level23_6: number;
    level38_2: number;
    level50: number;
    level61_8: number;
    level100: number;
  }
}

export interface TradingFormData {
  symbol: string;
  timeframe: string;
}
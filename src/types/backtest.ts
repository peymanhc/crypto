import { Recommendation, RiskLevel } from './trading';

// How a simulated trade is taken off: mirrors the autopilot's exit rules, plus the
// TP-ladder exits a signal follower would use instead of the channel profit %
export type BacktestExitMode = 'profit' | 'tp1' | 'tpFinal';

export interface BacktestConfig {
  symbols: string[];
  timeframe: string;
  // Total candles per symbol to simulate over (newest N candles)
  candles: number;
  exitMode: BacktestExitMode;
  // Leveraged profit % that closes the trade in 'profit' mode (the autopilot's targetPct)
  targetPct: number;
  riskLevels: RiskLevel[];
  // Per-side fee and slippage as % of notional (both charged twice: entry + exit)
  feePct: number;
  slippagePct: number;
  // Share of equity used as margin for each trade
  sizePct: number;
  startEquity: number;
  // Trades that never resolve are closed after this many hours (autopilot: 24h)
  maxHoldHours: number;
}

export type BacktestCloseReason = 'stop' | 'profit' | 'tp' | 'expired' | 'end';

// A closed trade straight out of the simulation (before the account balance is known)
export interface SimulatedTrade {
  symbol: string;
  base: string;
  direction: Recommendation;
  riskLevel: RiskLevel;
  score: number;
  leverage: number;
  entry: number;
  stopLoss: number;
  takeProfits: number[];
  // Price at which the exit rule fires in this run (profit threshold or chosen TP)
  target: number;
  openedAt: number;
  closedAt: number;
  exitPrice: number;
  reason: BacktestCloseReason;
  // Leveraged PnL % after fees and slippage
  pnlPct: number;
  // Same, before costs
  grossPnlPct: number;
  holdMs: number;
}

// The same trade once the equity curve has been built
export interface BacktestTrade extends SimulatedTrade {
  // Account balance right after this trade closed
  equityAfter: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdownPct: number;
}

export interface BacktestStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  expectancyPct: number;
  profitFactor: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  bestPct: number;
  worstPct: number;
  avgHoldMs: number;
  longs: number;
  shorts: number;
  maxConsecutiveLosses: number;
  byReason: Record<BacktestCloseReason, number>;
  // Time span actually covered by the candle data
  from: number;
  to: number;
  // Signals seen but skipped by the risk filter / cooldown / an open trade
  skippedByRisk: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  equity: EquityPoint[];
  stats: BacktestStats;
  perSymbol: { symbol: string; trades: number; winRate: number; pnlPct: number; candles: number }[];
}

export interface BacktestProgress {
  phase: 'loading' | 'simulating' | 'done';
  symbol?: string;
  // 0..1
  value: number;
}

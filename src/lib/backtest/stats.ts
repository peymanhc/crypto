// Summary numbers for a finished backtest.
import { BacktestConfig, BacktestStats, BacktestTrade, EquityPoint, BacktestCloseReason } from '../../types/backtest';
import { SymbolRun } from './simulateSymbol';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => (values.length ? sum(values) / values.length : 0);

// Longest run of losing trades in a row
const longestLosingStreak = (trades: BacktestTrade[]): number => {
  let streak = 0;
  let longest = 0;
  for (const trade of trades) {
    streak = trade.pnlPct <= 0 ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  }
  return longest;
};

const countByReason = (trades: BacktestTrade[]): Record<BacktestCloseReason, number> => {
  const counts: Record<BacktestCloseReason, number> = { stop: 0, profit: 0, tp: 0, expired: 0, end: 0 };
  for (const trade of trades) counts[trade.reason] += 1;
  return counts;
};

export const buildStats = (
  trades: BacktestTrade[],
  equity: EquityPoint[],
  runs: SymbolRun[],
  config: BacktestConfig
): BacktestStats => {
  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const grossWin = sum(wins.map((t) => t.pnlPct));
  const grossLoss = Math.abs(sum(losses.map((t) => t.pnlPct)));
  const finalEquity = equity[equity.length - 1]?.equity ?? config.startEquity;
  const pnls = trades.map((t) => t.pnlPct);

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWinPct: average(wins.map((t) => t.pnlPct)),
    avgLossPct: average(losses.map((t) => t.pnlPct)),
    expectancyPct: average(pnls),
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length ? Infinity : 0,
    totalReturnPct: ((finalEquity - config.startEquity) / config.startEquity) * 100,
    maxDrawdownPct: Math.max(0, ...equity.map((p) => p.drawdownPct)),
    bestPct: trades.length ? Math.max(...pnls) : 0,
    worstPct: trades.length ? Math.min(...pnls) : 0,
    avgHoldMs: average(trades.map((t) => t.holdMs)),
    longs: trades.filter((t) => t.direction === 'Long').length,
    shorts: trades.filter((t) => t.direction === 'Short').length,
    maxConsecutiveLosses: longestLosingStreak(trades),
    byReason: countByReason(trades),
    from: runs.length ? Math.min(...runs.map((r) => r.from)) : 0,
    to: runs.length ? Math.max(...runs.map((r) => r.to)) : 0,
    skippedByRisk: sum(runs.map((r) => r.skippedByRisk)),
  };
};

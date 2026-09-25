// Turns the list of closed trades into an account balance over time.
import { BacktestConfig, BacktestTrade, EquityPoint, SimulatedTrade } from '../../types/backtest';

export interface EquityResult {
  trades: BacktestTrade[];
  equity: EquityPoint[];
}

// Trades are applied in the order they closed. Each trade risks `sizePct` of the
// current equity as margin, so the leveraged PnL % of the trade moves that margin.
export const buildEquityCurve = (simulated: SimulatedTrade[], config: BacktestConfig, startTime: number): EquityResult => {
  const byCloseTime = [...simulated].sort((a, b) => a.closedAt - b.closedAt);
  let equity = config.startEquity;
  let peak = equity;
  const points: EquityPoint[] = [{ time: startTime, equity, drawdownPct: 0 }];
  const trades: BacktestTrade[] = [];

  for (const trade of byCloseTime) {
    const margin = equity * (config.sizePct / 100);
    equity += margin * (trade.pnlPct / 100);
    peak = Math.max(peak, equity);
    const drawdownPct = ((peak - equity) / peak) * 100;
    points.push({ time: trade.closedAt, equity, drawdownPct });
    trades.push({ ...trade, equityAfter: equity });
  }

  return { trades, equity: points };
};

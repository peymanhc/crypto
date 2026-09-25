// The small pieces of trading arithmetic the simulation is built from.
import { TradePlan } from '../../types/trading';
import { BacktestConfig } from '../../types/backtest';

// Leveraged profit in % for a trade that entered at `entry` and exited at `exit`
export const leveragedPnlPct = (direction: string, entry: number, leverage: number, exit: number): number => {
  const sign = direction === 'Long' ? 1 : -1;
  return ((exit - entry) / entry) * 100 * leverage * sign;
};

// The price at which the chosen exit rule closes the trade
export const exitPrice = (plan: TradePlan, config: BacktestConfig): number => {
  const lastTp = plan.takeProfits[plan.takeProfits.length - 1];
  if (config.exitMode === 'tp1' && plan.takeProfits.length) return plan.takeProfits[0];
  if (config.exitMode === 'tpFinal' && plan.takeProfits.length) return lastTp;

  // Autopilot: closes once leveraged PnL >= targetPct.
  // Leveraged move = raw move * leverage, so the raw move needed is targetPct / leverage.
  const rawMove = config.targetPct / 100 / Math.max(1, plan.leverage);
  return plan.direction === 'Long' ? plan.entry * (1 + rawMove) : plan.entry * (1 - rawMove);
};

// Fees and slippage are paid twice (entry + exit) and scale with leverage
export const roundTripCostPct = (config: BacktestConfig, leverage: number): number =>
  2 * (config.feePct + config.slippagePct) * leverage;

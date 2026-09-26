// Replays one coin candle by candle with the production signal and exit rules.
import { Candle, analyzeCandles, buildTradePlan, timeframeMs, baseAsset } from '../analysis';
import { TradePlan } from '../../types/trading';
import { BacktestConfig, BacktestCloseReason, SimulatedTrade } from '../../types/backtest';
import { ANALYSIS_WINDOW, MIN_COOLDOWN_MS } from './config';
import { exitPrice, leveragedPnlPct, roundTripCostPct } from './rules';

export interface SymbolRun {
  symbol: string;
  trades: SimulatedTrade[];
  candles: number;
  from: number;
  to: number;
  skippedByRisk: number;
}

interface OpenPosition {
  plan: TradePlan;
  target: number;
  openedAt: number;
  openIndex: number;
}

// Lets the browser paint between chunks of work
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

// Signal on the last `ANALYSIS_WINDOW` candles ending at index `i`, or null when Neutral / no data
const signalAt = (candles: Candle[], i: number): TradePlan | null => {
  const window = candles.slice(i - ANALYSIS_WINDOW + 1, i + 1);
  try {
    const plan = buildTradePlan(analyzeCandles(window));
    return plan.direction === 'Neutral' ? null : plan;
  } catch {
    return null;
  }
};

// Which exit rule (if any) fires on this candle. Stop wins when both hit in the same candle.
const exitReasonFor = (position: OpenPosition, candle: Candle, config: BacktestConfig): BacktestCloseReason | null => {
  const { plan, target } = position;
  const isLong = plan.direction === 'Long';
  const stopHit = isLong ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
  const targetHit = isLong ? candle.high >= target : candle.low <= target;
  const expired = candle.openTime - position.openedAt >= config.maxHoldHours * 3_600_000;

  if (stopHit) return 'stop';
  if (targetHit) return config.exitMode === 'profit' ? 'profit' : 'tp';
  if (expired) return 'expired';
  return null;
};

// Exit price for a given reason: the stop level, the target level, or the candle open on expiry
const exitPriceFor = (position: OpenPosition, reason: BacktestCloseReason, candle: Candle): number => {
  if (reason === 'stop') return position.plan.stopLoss;
  if (reason === 'expired' || reason === 'end') return reason === 'end' ? candle.close : candle.open;
  return position.target;
};

const buildTrade = (
  symbol: string,
  position: OpenPosition,
  reason: BacktestCloseReason,
  price: number,
  closedAt: number,
  config: BacktestConfig
): SimulatedTrade => {
  const { plan } = position;
  const grossPnlPct = leveragedPnlPct(plan.direction, plan.entry, plan.leverage, price);
  return {
    symbol,
    base: baseAsset(symbol),
    direction: plan.direction,
    riskLevel: plan.riskLevel,
    score: plan.score,
    leverage: plan.leverage,
    entry: plan.entry,
    stopLoss: plan.stopLoss,
    takeProfits: plan.takeProfits,
    target: position.target,
    openedAt: position.openedAt,
    closedAt,
    exitPrice: price,
    reason,
    grossPnlPct,
    pnlPct: grossPnlPct - roundTripCostPct(config, plan.leverage),
    holdMs: closedAt - position.openedAt,
  };
};

export async function simulateSymbol(
  symbol: string,
  candles: Candle[],
  config: BacktestConfig,
  onProgress?: (value: number) => void
): Promise<SymbolRun> {
  const candleMs = timeframeMs(config.timeframe);
  const cooldownMs = Math.max(candleMs, MIN_COOLDOWN_MS);
  const trades: SimulatedTrade[] = [];
  let position: OpenPosition | null = null;
  let lastClosedAt = -Infinity;
  let skippedByRisk = 0;

  for (let i = ANALYSIS_WINDOW - 1; i < candles.length; i++) {
    const candle = candles[i];
    const candleCloseTime = candle.openTime + candleMs;

    // 1. Manage the open trade (exits start on the candle after the entry)
    if (position && i > position.openIndex) {
      const reason = exitReasonFor(position, candle, config);
      if (reason) {
        const price = exitPriceFor(position, reason, candle);
        const closedAt = reason === 'expired' ? candle.openTime : candleCloseTime;
        trades.push(buildTrade(symbol, position, reason, price, closedAt, config));
        lastClosedAt = closedAt;
        position = null;
      }
    }

    // 2. Look for a new signal when flat and out of cooldown
    const inCooldown = candleCloseTime - lastClosedAt < cooldownMs;
    if (!position && !inCooldown) {
      const plan = signalAt(candles, i);
      if (plan && !config.riskLevels.includes(plan.riskLevel)) skippedByRisk += 1;
      else if (plan) position = { plan, target: exitPrice(plan, config), openedAt: candleCloseTime, openIndex: i };
    }

    if (i % 150 === 0) {
      onProgress?.((i + 1) / candles.length);
      await yieldToBrowser();
    }
  }

  // A trade still open when the data ends is marked at the last close so nothing is hidden
  if (position) {
    const last = candles[candles.length - 1];
    trades.push(buildTrade(symbol, position, 'end', last.close, last.openTime + candleMs, config));
  }

  return {
    symbol,
    trades,
    candles: candles.length,
    from: candles[0]?.openTime ?? 0,
    to: (candles[candles.length - 1]?.openTime ?? 0) + candleMs,
    skippedByRisk,
  };
}

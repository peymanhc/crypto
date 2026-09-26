// The "pump short" of the Telegram autopilot, executed on Hyperliquid: every coin up more
// than a threshold in 24h is shorted with the same fixed rules the Worker uses.
import { TradePlan } from '../../types/trading';
import { HlNetwork } from '../../types/hyperliquid';
import { infoClientFor } from './client';

// Same numbers as telegram-worker/src/index.js
export const PUMP_LEVERAGE = 4;
export const PUMP_TP_PCTS = [10, 20]; // take profits 10% and 20% below entry
export const PUMP_SL_PCT = 10; // stop 10% above entry
export const PUMP_MIN_DAY_VOLUME_USD = 50_000; // skip dead markets whose "pump" is one stray trade
export const PUMP_COOLDOWN_MS = 24 * 3_600_000; // one short per pump

export interface PumpMarket {
  coin: string;
  markPx: number;
  changePct: number;
  volume: number;
}

// Perps sorted by 24h change, dead and delisted markets excluded
export const fetchPumpCandidates = async (network: HlNetwork): Promise<PumpMarket[]> => {
  const [meta, ctxs] = await infoClientFor(network).metaAndAssetCtxs();
  const markets: PumpMarket[] = [];
  meta.universe.forEach((asset, i) => {
    const ctx = ctxs[i];
    const mark = Number(ctx?.markPx);
    const prev = Number(ctx?.prevDayPx);
    const volume = Number(ctx?.dayNtlVlm);
    if (asset.isDelisted || !Number.isFinite(mark) || !Number.isFinite(prev) || prev <= 0) return;
    markets.push({ coin: asset.name, markPx: mark, changePct: (mark / prev - 1) * 100, volume: Number.isFinite(volume) ? volume : 0 });
  });
  return markets.sort((a, b) => b.changePct - a.changePct);
};

// The Worker's plan for a pump: 4x short, TP ladder below, stop above
export const pumpShortPlan = (market: PumpMarket): TradePlan => ({
  direction: 'Short',
  riskLevel: 'High',
  leverage: PUMP_LEVERAGE,
  entry: market.markPx,
  takeProfits: PUMP_TP_PCTS.map((pct) => market.markPx * (1 - pct / 100)),
  stopLoss: market.markPx * (1 + PUMP_SL_PCT / 100),
  score: 0,
});

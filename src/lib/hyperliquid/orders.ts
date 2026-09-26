// Opens and closes positions on Hyperliquid from a dashboard TradePlan.
// The plan itself (entry, stop, take profits, leverage) is produced by the untouched
// dashboard analysis; this file only turns it into exchange orders.
import { TradePlan, Recommendation } from '../../types/trading';
import { HlAccount, HlOpenResult, HlPosition, HlSession, HlSettings } from '../../types/hyperliquid';
import { baseAsset } from '../analysis';
import { agentExchangeClient, infoClientFor, loadMarkets, midPrice, PerpMarket } from './client';
import { roundPrice, roundSize } from './rounding';

// "BTC/USDT" -> the Hyperliquid perp "BTC", or an error when it is not listed
export const marketFor = async (session: HlSession, symbol: string): Promise<PerpMarket> => {
  const coin = baseAsset(symbol);
  const market = (await loadMarkets(session.network)).get(coin);
  if (!market) throw new Error(`not-listed:${coin}`);
  return market;
};

type OrderStatus = { resting: { oid: number } } | { filled: { totalSz: string; avgPx: string; oid: number } } | string;

// The fill details of an order status, or null when it did not fill
const filledOf = (status: OrderStatus) => (typeof status === 'object' && 'filled' in status ? status.filled : null);

// Entry price for an IOC "market" order: a little through the mid so it fills
const marketPrice = (mid: number, isBuy: boolean, slippagePct: number, szDecimals: number): string =>
  roundPrice(mid * (isBuy ? 1 + slippagePct / 100 : 1 - slippagePct / 100), szDecimals);

// Which take profit of the signal is used on the exchange
const takeProfitOf = (plan: TradePlan, settings: HlSettings): number => {
  if (!plan.takeProfits.length) throw new Error('no-take-profit');
  return settings.takeProfit === 'tp1' ? plan.takeProfits[0] : plan.takeProfits[plan.takeProfits.length - 1];
};

// Places the entry plus its stop loss and take profit (reduce-only triggers) in one grouped order
export const openFromPlan = async (session: HlSession, settings: HlSettings, symbol: string, plan: TradePlan): Promise<HlOpenResult> => {
  if (plan.direction === 'Neutral') throw new Error('neutral');
  const market = await marketFor(session, symbol);
  const exchange = agentExchangeClient(session.network, session.agentPrivateKey);
  const isBuy = plan.direction === 'Long';
  const leverage = Math.max(1, Math.min(plan.leverage, settings.maxLeverage, market.maxLeverage));

  await exchange.updateLeverage({ asset: market.index, isCross: settings.isCross, leverage });

  const mid = await midPrice(session.network, market.coin);
  const size = roundSize((settings.marginUsd * leverage) / mid, market.szDecimals);
  if (Number(size) <= 0) throw new Error('size-too-small');

  const takeProfitPx = takeProfitOf(plan, settings);
  const stopPx = roundPrice(plan.stopLoss, market.szDecimals);
  const tpPx = roundPrice(takeProfitPx, market.szDecimals);
  const entry = { a: market.index, b: isBuy, p: marketPrice(mid, isBuy, settings.slippagePct, market.szDecimals), s: size, r: false, t: { limit: { tif: 'Ioc' as const } } };
  const stopLoss = { a: market.index, b: !isBuy, p: stopPx, s: size, r: true, t: { trigger: { isMarket: true, triggerPx: stopPx, tpsl: 'sl' as const } } };
  const takeProfit = { a: market.index, b: !isBuy, p: tpPx, s: size, r: true, t: { trigger: { isMarket: true, triggerPx: tpPx, tpsl: 'tp' as const } } };

  const response = await exchange.order({ orders: [entry, takeProfit, stopLoss], grouping: 'normalTpsl' });
  const filled = filledOf(response.response.data.statuses[0]);
  if (!filled) throw new Error('not-filled');

  return { coin: market.coin, size: Number(filled.totalSz), avgPx: Number(filled.avgPx), leverage, takeProfitPx, stopLossPx: plan.stopLoss };
};

// Reads balance and open positions of the main account
export const readAccount = async (session: HlSession): Promise<HlAccount> => {
  const state = await infoClientFor(session.network).clearinghouseState({ user: session.mainAddress });
  const positions: HlPosition[] = state.assetPositions
    .map(({ position }) => position)
    .filter((p) => Number(p.szi) !== 0)
    .map((p) => {
      const size = Number(p.szi);
      const direction: Recommendation = size > 0 ? 'Long' : 'Short';
      return {
        coin: p.coin,
        size: Math.abs(size),
        direction,
        entryPx: Number(p.entryPx),
        leverage: p.leverage.value,
        unrealizedPnl: Number(p.unrealizedPnl),
        positionValue: Number(p.positionValue),
        liquidationPx: p.liquidationPx === null ? null : Number(p.liquidationPx),
      };
    });
  return {
    accountValue: Number(state.marginSummary.accountValue),
    withdrawable: Number(state.withdrawable),
    marginUsed: Number(state.marginSummary.totalMarginUsed),
    positions,
  };
};

// Cancels every resting order (including TP / SL triggers) of one coin
const cancelCoinOrders = async (session: HlSession, market: PerpMarket) => {
  const open = await infoClientFor(session.network).openOrders({ user: session.mainAddress });
  const mine = open.filter((o) => o.coin === market.coin);
  if (!mine.length) return;
  const exchange = agentExchangeClient(session.network, session.agentPrivateKey);
  await exchange.cancel({ cancels: mine.map((o) => ({ a: market.index, o: o.oid })) });
};

// Market-closes the whole position of a coin and removes its leftover triggers
export const closePosition = async (session: HlSession, settings: HlSettings, position: HlPosition): Promise<number> => {
  const market = (await loadMarkets(session.network)).get(position.coin);
  if (!market) throw new Error(`not-listed:${position.coin}`);
  const exchange = agentExchangeClient(session.network, session.agentPrivateKey);
  const isBuy = position.direction === 'Short';
  const mid = await midPrice(session.network, market.coin);
  const response = await exchange.order({
    orders: [{ a: market.index, b: isBuy, p: marketPrice(mid, isBuy, settings.slippagePct, market.szDecimals), s: roundSize(position.size, market.szDecimals), r: true, t: { limit: { tif: 'Ioc' } } }],
    grouping: 'na',
  });
  await cancelCoinOrders(session, market);
  const filled = filledOf(response.response.data.statuses[0]);
  return filled ? Number(filled.avgPx) : mid;
};

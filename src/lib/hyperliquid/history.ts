// Account history straight from the exchange: executed fills and resting orders.
import { HlFill, HlOpenOrder, HlSession } from '../../types/hyperliquid';
import { agentExchangeClient, infoClientFor, loadMarkets } from './client';

const FILLS_KEPT = 100;

// Latest fills, newest first
export const readFills = async (session: HlSession): Promise<HlFill[]> => {
  const fills = await infoClientFor(session.network).userFills({ user: session.mainAddress });
  return fills
    .map((f) => ({
      time: f.time,
      coin: f.coin,
      dir: f.dir,
      side: f.side === 'B' ? ('buy' as const) : ('sell' as const),
      price: Number(f.px),
      size: Number(f.sz),
      closedPnl: Number(f.closedPnl),
      fee: Number(f.fee),
      oid: f.oid,
      hash: f.hash,
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, FILLS_KEPT);
};

// Resting orders including TP / SL triggers, newest first
export const readOpenOrders = async (session: HlSession): Promise<HlOpenOrder[]> => {
  const orders = await infoClientFor(session.network).frontendOpenOrders({ user: session.mainAddress });
  return orders
    .map((o) => ({
      oid: o.oid,
      coin: o.coin,
      side: o.side === 'B' ? ('buy' as const) : ('sell' as const),
      size: Number(o.sz),
      limitPx: Number(o.limitPx),
      isTrigger: o.isTrigger,
      triggerPx: o.isTrigger ? Number(o.triggerPx) : null,
      triggerCondition: o.triggerCondition,
      reduceOnly: o.reduceOnly,
      timestamp: o.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
};

// Cancels one resting order
export const cancelOrder = async (session: HlSession, order: HlOpenOrder): Promise<void> => {
  const market = (await loadMarkets(session.network)).get(order.coin);
  if (!market) throw new Error(`not-listed:${order.coin}`);
  await agentExchangeClient(session.network, session.agentPrivateKey).cancel({ cancels: [{ a: market.index, o: order.oid }] });
};

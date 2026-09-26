import { useCallback, useEffect, useState } from 'react';
import { HlFill, HlOpenOrder, HlSession } from '../types/hyperliquid';
import { readFills, readOpenOrders, cancelOrder } from '../lib/hyperliquid/history';

const REFRESH_MS = 30_000;

// Fills and resting orders of the logged-in account, refreshed every 30 s
export const useHlHistory = (session: HlSession | null) => {
  const [fills, setFills] = useState<HlFill[]>([]);
  const [orders, setOrders] = useState<HlOpenOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const [f, o] = await Promise.all([readFills(session), readOpenOrders(session)]);
      setFills(f);
      setOrders(o);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setFills([]);
      setOrders([]);
      setLoaded(false);
      return;
    }
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [session, refresh]);

  const cancel = async (order: HlOpenOrder) => {
    if (!session) return;
    setCancelling(order.oid);
    try {
      await cancelOrder(session, order);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelling(null);
    }
  };

  return { fills, orders, loaded, error, refresh, cancel, cancelling };
};

import { useCallback, useEffect, useState } from 'react';
import { HlAccount, HlPosition, HlSession, HlSettings } from '../types/hyperliquid';
import { readAccount, closePosition } from '../lib/hyperliquid/orders';

const REFRESH_MS = 15_000;

// Balance and open positions, refreshed every 15 s while logged in
export const useHlAccount = (session: HlSession | null, settings: HlSettings) => {
  const [account, setAccount] = useState<HlAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      setAccount(await readAccount(session));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setAccount(null);
      return;
    }
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [session, refresh]);

  // Market-closes one position; resolves to the fill price
  const close = async (position: HlPosition): Promise<number> => {
    if (!session) throw new Error('no-session');
    setClosing(position.coin);
    try {
      const price = await closePosition(session, settings, position);
      await refresh();
      return price;
    } finally {
      setClosing(null);
    }
  };

  return { account, error, refresh, close, closing };
};

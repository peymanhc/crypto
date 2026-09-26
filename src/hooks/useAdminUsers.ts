import { useCallback, useEffect, useState } from 'react';
import { ManagedUser, adminListUsers, adminCreateUser, adminUpdateUser } from '../services/auth';
import { PnlSummary, readPnl } from '../lib/hyperliquid/pnl';

// The admin's list of users, with each one's realised Hyperliquid PnL (mainnet accounts only)
export const useAdminUsers = () => {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [pnl, setPnl] = useState<Record<string, PnlSummary | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadPnl = useCallback(async (list: ManagedUser[]) => {
    for (const user of list) {
      const mainnet = user.hlAddresses.filter((a) => a.network === 'mainnet');
      if (!mainnet.length) continue;
      try {
        const parts = await Promise.all(mainnet.map((a) => readPnl('mainnet', a.address)));
        const total = parts.reduce<PnlSummary>((acc, p) => ({ closedPnl: acc.closedPnl + p.closedPnl, fees: acc.fees + p.fees, net: acc.net + p.net, fills: acc.fills + p.fills }), { closedPnl: 0, fees: 0, net: 0, fills: 0 });
        setPnl((prev) => ({ ...prev, [user.username]: total }));
      } catch {
        setPnl((prev) => ({ ...prev, [user.username]: null }));
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await adminListUsers();
      setUsers(list);
      setError(null);
      loadPnl(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [loadPnl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (username: string, password: string, expiresAt: number) => {
    await adminCreateUser(username, password, expiresAt);
    await refresh();
  };

  const update = async (username: string, action: 'disable' | 'enable' | 'delete' | 'extend', expiresAt?: number) => {
    setBusy(username);
    try {
      setUsers(await adminUpdateUser(username, action, expiresAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // Everyone's net PnL added up (only users whose PnL loaded)
  const totalNet = Object.values(pnl).reduce((sum, p) => sum + (p?.net ?? 0), 0);

  return { users, pnl, totalNet, error, busy, refresh, create, update };
};

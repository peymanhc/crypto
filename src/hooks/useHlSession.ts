import { useState } from 'react';
import { HlNetwork, HlSession } from '../types/hyperliquid';
import { loadSession, saveSession } from '../lib/hyperliquid/session';
import { connectBrowserWallet, approveNewAgent, sessionFromApiKey } from '../lib/hyperliquid/wallet';
import { reportHlAddress } from '../services/auth';

// Login state for the Trade tab: a browser wallet + approved agent, or a pasted API key
export const useHlSession = () => {
  const [session, setSession] = useState<HlSession | null>(loadSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (next: HlSession) => {
    saveSession(next);
    setSession(next);
    // So the admin's overview can show this account's PnL
    reportHlAddress(next.mainAddress, next.network);
  };

  const run = async (task: () => Promise<HlSession>) => {
    setBusy(true);
    setError(null);
    try {
      finish(await task());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const loginWithWallet = (network: HlNetwork) =>
    run(async () => approveNewAgent(network, await connectBrowserWallet()));

  const loginWithApiKey = (network: HlNetwork, mainAddress: string, agentPrivateKey: string) =>
    run(async () => sessionFromApiKey(network, mainAddress, agentPrivateKey));

  const logout = () => {
    saveSession(null);
    setSession(null);
  };

  return { session, busy, error, loginWithWallet, loginWithApiKey, logout };
};

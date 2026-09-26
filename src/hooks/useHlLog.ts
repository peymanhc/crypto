import { useState } from 'react';
import { HlTradeLogEntry } from '../types/hyperliquid';
import { appendLog, loadLog } from '../lib/hyperliquid/session';

// What the app did on Hyperliquid, newest first
export const useHlLog = () => {
  const [entries, setEntries] = useState<HlTradeLogEntry[]>(loadLog);
  const add = (entry: Omit<HlTradeLogEntry, 'at'>) => setEntries(appendLog({ ...entry, at: Date.now() }));
  return { entries, add };
};

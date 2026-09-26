import { Recommendation, RiskLevel, TradePlan } from './trading';

export type HlNetwork = 'mainnet' | 'testnet';

// How the user logged in: a browser wallet that approved an agent key, or a pasted API key
export type HlLoginMode = 'wallet' | 'apiKey';

export interface HlSession {
  mode: HlLoginMode;
  network: HlNetwork;
  // The account whose funds are traded
  mainAddress: `0x${string}`;
  // Private key of the agent (API wallet) that signs orders; it cannot withdraw
  agentPrivateKey: `0x${string}`;
  createdAt: number;
}

// Which take profit of the signal closes the position on Hyperliquid
export type HlTakeProfitMode = 'tp1' | 'tpFinal';

export interface HlSettings {
  // USD of margin put into each trade; notional = margin x leverage
  marginUsd: number;
  // Signals asking for more leverage are capped here
  maxLeverage: number;
  isCross: boolean;
  takeProfit: HlTakeProfitMode;
  // Price tolerance for the IOC "market" entry / exit, in %
  slippagePct: number;
}

// The auto-trader watchlist (mirrors the Autopilot settings)
export interface AutoTradeConfig {
  enabled: boolean;
  coins: string[];
  timeframe: string;
  riskLevels: RiskLevel[];
}

export type AutoTradeOutcome = 'opened' | 'no-signal' | 'position-open' | 'risk-filtered' | 'error';

export interface AutoTradeScanResult {
  coin: string;
  status: AutoTradeOutcome;
  direction?: Recommendation;
  riskLevel?: RiskLevel;
  error?: string;
}

// One position on Hyperliquid, as read from the account
export interface HlPosition {
  coin: string;
  size: number;
  direction: Recommendation;
  entryPx: number;
  leverage: number;
  unrealizedPnl: number;
  positionValue: number;
  liquidationPx: number | null;
}

export interface HlAccount {
  accountValue: number;
  withdrawable: number;
  marginUsed: number;
  positions: HlPosition[];
}

// Local record of what the app did on Hyperliquid, for the log
export interface HlTradeLogEntry {
  at: number;
  kind: 'open' | 'close' | 'error';
  coin: string;
  direction?: Recommendation;
  size?: number;
  price?: number;
  leverage?: number;
  plan?: TradePlan;
  message?: string;
}

// What was placed for one signal
export interface HlOpenResult {
  coin: string;
  size: number;
  avgPx: number;
  leverage: number;
  takeProfitPx: number;
  stopLossPx: number;
}

// One executed fill from the exchange history
export interface HlFill {
  time: number;
  coin: string;
  // "Open Long", "Close Short", "Long > Short", ... as Hyperliquid words it
  dir: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  closedPnl: number;
  fee: number;
  oid: number;
  hash: string;
}

// A resting order (limit or TP / SL trigger) on the exchange
export interface HlOpenOrder {
  oid: number;
  coin: string;
  side: 'buy' | 'sell';
  size: number;
  limitPx: number;
  isTrigger: boolean;
  triggerPx: number | null;
  triggerCondition: string;
  reduceOnly: boolean;
  timestamp: number;
}

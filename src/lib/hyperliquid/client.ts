// Thin wrappers around the Hyperliquid SDK: transports, clients and the perps metadata.
import { HttpTransport, InfoClient, ExchangeClient } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { HlNetwork } from '../../types/hyperliquid';

export const transportFor = (network: HlNetwork) => new HttpTransport({ isTestnet: network === 'testnet' });

export const infoClientFor = (network: HlNetwork) => new InfoClient({ transport: transportFor(network) });

// Orders are signed by the agent key that the user approved (or pasted)
export const agentExchangeClient = (network: HlNetwork, agentPrivateKey: `0x${string}`) =>
  new ExchangeClient({ transport: transportFor(network), wallet: privateKeyToAccount(agentPrivateKey) });

export interface PerpMarket {
  // Position of the coin in the universe = the `a` (asset) field of orders
  index: number;
  coin: string;
  szDecimals: number;
  maxLeverage: number;
}

const marketCache = new Map<HlNetwork, Map<string, PerpMarket>>();

// All perp markets keyed by coin name ("BTC"), cached per network
export const loadMarkets = async (network: HlNetwork): Promise<Map<string, PerpMarket>> => {
  const cached = marketCache.get(network);
  if (cached) return cached;
  const meta = await infoClientFor(network).meta();
  const markets = new Map<string, PerpMarket>();
  meta.universe.forEach((asset, index) => {
    markets.set(asset.name, { index, coin: asset.name, szDecimals: asset.szDecimals, maxLeverage: asset.maxLeverage });
  });
  marketCache.set(network, markets);
  return markets;
};

// Current mid price of one coin
export const midPrice = async (network: HlNetwork, coin: string): Promise<number> => {
  const mids = await infoClientFor(network).allMids();
  const price = parseFloat(mids[coin]);
  if (!Number.isFinite(price)) throw new Error(`no price for ${coin}`);
  return price;
};

// Login with a browser wallet (MetaMask, Rabby, ...): the main wallet signs ONE
// "approveAgent" message, then a freshly generated agent key trades on its behalf.
import { createWalletClient, custom } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ExchangeClient } from '@nktkas/hyperliquid';
import { HlNetwork, HlSession } from '../../types/hyperliquid';
import { transportFor } from './client';

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

const AGENT_NAME = 'CoinAnalysis';

export const hasBrowserWallet = (): boolean => typeof (window as { ethereum?: unknown }).ethereum !== 'undefined';

const provider = (): Eip1193Provider => {
  const eth = (window as { ethereum?: Eip1193Provider }).ethereum;
  if (!eth) throw new Error('no-wallet');
  return eth;
};

// Asks the wallet for its accounts and returns the first one
export const connectBrowserWallet = async (): Promise<`0x${string}`> => {
  const client = createWalletClient({ transport: custom(provider()) });
  const [address] = await client.requestAddresses();
  if (!address) throw new Error('no-account');
  return address;
};

// Generates an agent key and has the main wallet approve it (one signature popup)
export const approveNewAgent = async (network: HlNetwork, mainAddress: `0x${string}`): Promise<HlSession> => {
  const agentPrivateKey = generatePrivateKey();
  const agent = privateKeyToAccount(agentPrivateKey);
  const mainWallet = createWalletClient({ account: mainAddress, transport: custom(provider()) });
  const exchange = new ExchangeClient({ transport: transportFor(network), wallet: mainWallet });
  await exchange.approveAgent({ agentAddress: agent.address, agentName: AGENT_NAME });
  return { mode: 'wallet', network, mainAddress, agentPrivateKey, createdAt: Date.now() };
};

// Login by pasting an API wallet key created on app.hyperliquid.xyz (API page)
export const sessionFromApiKey = (network: HlNetwork, mainAddress: string, agentPrivateKey: string): HlSession => {
  const address = mainAddress.trim() as `0x${string}`;
  const raw = agentPrivateKey.trim();
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('bad-address');
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('bad-key');
  // Throws if the key is not a valid secp256k1 private key
  privateKeyToAccount(key);
  return { mode: 'apiKey', network, mainAddress: address, agentPrivateKey: key, createdAt: Date.now() };
};

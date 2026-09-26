// Realised PnL of a Hyperliquid account, from the exchange's public fill history.
import { HlNetwork } from '../../types/hyperliquid';
import { infoClientFor } from './client';

export interface PnlSummary {
  closedPnl: number;
  fees: number;
  net: number;
  fills: number;
}

// Sums the closed PnL and fees of the account's recent fills (the API returns up to the
// last 2000). Net = closed PnL minus fees.
export const readPnl = async (network: HlNetwork, address: string): Promise<PnlSummary> => {
  const fills = await infoClientFor(network).userFills({ user: address as `0x${string}` });
  const closedPnl = fills.reduce((sum, f) => sum + Number(f.closedPnl), 0);
  const fees = fills.reduce((sum, f) => sum + Number(f.fee), 0);
  return { closedPnl, fees, net: closedPnl - fees, fills: fills.length };
};

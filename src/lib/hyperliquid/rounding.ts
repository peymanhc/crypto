// Hyperliquid rejects orders whose numbers are too precise. Rules (perps):
//   price: at most 5 significant figures AND at most (6 - szDecimals) decimals;
//          integer prices are always fine
//   size:  at most szDecimals decimals
const MAX_DECIMALS = 6;

const trimZeros = (text: string): string => (text.includes('.') ? text.replace(/\.?0+$/, '') : text);

export const roundPrice = (price: number, szDecimals: number): string => {
  const maxDecimals = Math.max(0, MAX_DECIMALS - szDecimals);
  const fiveSignificant = Number(price.toPrecision(5));
  const rounded = Number(fiveSignificant.toFixed(maxDecimals));
  return trimZeros(rounded.toFixed(maxDecimals));
};

export const roundSize = (size: number, szDecimals: number): string => {
  const factor = 10 ** szDecimals;
  const floored = Math.floor(size * factor) / factor;
  return trimZeros(floored.toFixed(szDecimals));
};

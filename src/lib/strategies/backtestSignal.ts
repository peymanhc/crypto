// Bridges the strategy engines into the backtester.
import { SignalFn } from '../backtest';
import { loadEngineInputs } from './storage';
import { signalFor } from './engine';

// The signal function for the engine currently chosen on the Strategies / Builder tabs.
// Returns undefined for the dashboard engine so the backtest keeps its untouched default path.
export const activeEngineSignal = (): SignalFn | undefined => {
  const inputs = loadEngineInputs();
  if (inputs.engine === 'dashboard') return undefined;
  return (window) => signalFor(inputs, window);
};

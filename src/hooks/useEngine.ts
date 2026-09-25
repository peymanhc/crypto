import { useState } from 'react';
import { EngineId } from '../types/strategy';
import { loadEngine, saveEngine } from '../lib/strategies/storage';

// Which engine produces signals on the Strategies / Builder / Backtest tabs
export const useEngine = () => {
  const [engine, setEngineState] = useState<EngineId>(loadEngine);
  const setEngine = (next: EngineId) => {
    setEngineState(next);
    saveEngine(next);
  };
  return { engine, setEngine };
};

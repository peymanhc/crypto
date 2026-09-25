import { useState } from 'react';
import { TradingFormData } from '../types/trading';
import { EngineInputs, EngineResult, runEngine } from '../lib/strategies/engine';
import { fetchBacktestCandles } from '../lib/backtestData';
import { useI18n } from '../i18n';

// The Worker and the Dashboard analyse the latest 200 candles; so does the lab
const CANDLES = 200;

// Runs the chosen engine on live candles for the Signal lab
export const useSignalLab = (inputs: EngineInputs) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [submitted, setSubmitted] = useState<(TradingFormData & { at: number }) | null>(null);

  const run = async (form: TradingFormData) => {
    setLoading(true);
    setError(null);
    try {
      const candles = await fetchBacktestCandles(form.symbol, form.timeframe, CANDLES);
      setResult(runEngine(inputs, candles));
      setSubmitted({ ...form, at: Date.now() });
    } catch {
      setError(t('lab.error'));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return { run, loading, error, result, submitted };
};

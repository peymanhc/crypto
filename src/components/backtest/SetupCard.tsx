import { Layers, Play, Loader2, AlertTriangle, Percent } from 'lucide-react';
import { BacktestConfig } from '../../types/backtest';
import { TIMEFRAMES } from '../../constants/trading';
import Card from '../ui/Card';
import Field from '../ui/Field';
import CoinPicker from './CoinPicker';
import ExitRulePicker from './ExitRulePicker';
import RiskLevelPicker from './RiskLevelPicker';
import CostsFields from './CostsFields';
import { useI18n } from '../../i18n';

interface SetupCardProps {
  config: BacktestConfig;
  running: boolean;
  error: string | null;
  onChange: <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => void;
  onRun: () => void;
}

const MAX_COINS = 4;
const CANDLE_OPTIONS = [500, 1000, 2000, 3000, 5000];

// The whole backtest form: coins, timeframe, candles, exit rule, risk filter, costs, run button
const SetupCard: React.FC<SetupCardProps> = ({ config, running, error, onChange, onRun }) => {
  const { t, ttf } = useI18n();
  return (
  <Card title={t('bt.setup')} icon={<Layers className="h-4 w-4" />} className="z-20">
    <div className="space-y-3.5">
      <CoinPicker symbols={config.symbols} max={MAX_COINS} disabled={running} onChange={(symbols) => onChange('symbols', symbols)} />

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('bt.timeframe')}>
          <select value={config.timeframe} disabled={running} onChange={(e) => onChange('timeframe', e.target.value)} className="field !py-1.5 text-xs">
            {TIMEFRAMES.map(({ value }) => <option key={value} value={value}>{ttf(value)}</option>)}
          </select>
        </Field>
        <Field label={t('bt.candles')}>
          <select value={config.candles} disabled={running} onChange={(e) => onChange('candles', Number(e.target.value))} className="field !py-1.5 text-xs">
            {CANDLE_OPTIONS.map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
          </select>
        </Field>
      </div>

      <ExitRulePicker value={config.exitMode} disabled={running} onChange={(mode) => onChange('exitMode', mode)} />

      {config.exitMode === 'profit' && (
        <Field label={t('bt.target')}>
          <div className="relative">
            <Percent className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={config.targetPct}
              disabled={running}
              onChange={(e) => onChange('targetPct', Math.min(100, Math.max(0.1, Number(e.target.value) || 2)))}
              className="field !py-1.5 ps-8 text-xs"
            />
          </div>
        </Field>
      )}

      <RiskLevelPicker value={config.riskLevels} disabled={running} onChange={(levels) => onChange('riskLevels', levels)} />

      <CostsFields config={config} disabled={running} onChange={onChange} />

      <button type="button" onClick={onRun} disabled={running} className="btn-primary w-full !py-2.5">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? t('bt.running') : t('bt.run')}
      </button>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-short/30 bg-short/10 px-2.5 py-2 text-[11px] text-short">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  </Card>
  );
};

export default SetupCard;

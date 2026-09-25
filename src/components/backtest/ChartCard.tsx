import { useState } from 'react';
import { Activity } from 'lucide-react';
import { BacktestResult } from '../../types/backtest';
import Card from '../ui/Card';
import EquityChart from './EquityChart';
import { useI18n } from '../../i18n';

type Mode = 'equity' | 'drawdown';

// Equity / drawdown chart with a toggle in the card header
const ChartCard: React.FC<{ result: BacktestResult }> = ({ result }) => {
  const [mode, setMode] = useState<Mode>('equity');
  const { t } = useI18n();

  const toggle = (
    <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 text-[11px]">
      {(['equity', 'drawdown'] as Mode[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setMode(option)}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${mode === option ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {option === 'equity' ? t('bt.chart.equityTab') : t('bt.chart.drawdownTab')}
        </button>
      ))}
    </div>
  );

  return (
    <Card hover={false} title={mode === 'equity' ? t('bt.chart.equity') : t('bt.chart.drawdown')} icon={<Activity className="h-4 w-4" />} right={toggle}>
      <div dir="ltr" className="h-64 sm:h-80">
        <EquityChart points={result.equity} startEquity={result.config.startEquity} mode={mode} />
      </div>
    </Card>
  );
};

export default ChartCard;

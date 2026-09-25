import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { BacktestResult } from '../../types/backtest';
import Card from '../ui/Card';
import VerdictBanner from './VerdictBanner';
import StatsGrid from './StatsGrid';
import ChartCard from './ChartCard';
import ExitBreakdown from './ExitBreakdown';
import PerCoinList from './PerCoinList';
import TradeTable from './TradeTable';
import { useI18n } from '../../i18n';

// Everything shown after a run finishes, top to bottom
const ResultsView: React.FC<{ result: BacktestResult }> = ({ result }) => {
  const { t } = useI18n();
  return (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
    {result.stats.trades > 0 && <VerdictBanner result={result} />}
    <StatsGrid stats={result.stats} />
    <ChartCard result={result} />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ExitBreakdown result={result} />
      <PerCoinList result={result} />
    </div>
    <Card hover={false} title={t('bt.trades', { count: result.trades.length })} icon={<Layers className="h-4 w-4" />}>
      {result.trades.length > 0 ? (
        <TradeTable trades={result.trades} />
      ) : (
        <p className="text-sm text-slate-400">{t('bt.noTrades')}</p>
      )}
    </Card>
  </motion.div>
  );
};

export default ResultsView;

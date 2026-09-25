import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { BacktestResult, BacktestCloseReason } from '../../types/backtest';
import Card from '../ui/Card';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

const ROWS: { reason: BacktestCloseReason; label: TranslationKey; color: string }[] = [
  { reason: 'profit', label: 'bt.reason.profit', color: 'bg-long' },
  { reason: 'tp', label: 'bt.reason.tp', color: 'bg-long' },
  { reason: 'stop', label: 'bt.reason.stop', color: 'bg-short' },
  { reason: 'expired', label: 'bt.reason.expired', color: 'bg-glow-amber' },
  { reason: 'end', label: 'bt.reason.end', color: 'bg-slate-500' },
];

// How the trades ended: one bar per exit reason
const ExitBreakdown: React.FC<{ result: BacktestResult }> = ({ result }) => {
  const { byReason, trades } = result.stats;
  const { t } = useI18n();

  return (
    <Card hover={false} title={t('bt.exits')} icon={<Target className="h-4 w-4" />}>
      <div className="space-y-2">
        {ROWS.filter((row) => byReason[row.reason] > 0).map((row) => {
          const count = byReason[row.reason];
          const share = (count / trades) * 100;
          return (
            <div key={row.reason} className="text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>{t(row.label)}</span>
                <span className="num text-slate-400">{count} · {share.toFixed(0)}%</span>
              </div>
              <div dir="ltr" className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.span initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className={`block h-full rounded-full ${row.color}`} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default ExitBreakdown;

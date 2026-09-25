import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { BacktestProgress } from '../../types/backtest';
import { useI18n } from '../../i18n';

// Shown while candles load and the simulation runs
const ProgressCard: React.FC<{ progress: BacktestProgress }> = ({ progress }) => {
  const { t } = useI18n();
  const percent = Math.round(progress.value * 100);
  const label = progress.phase === 'loading' ? t('bt.loading') : t('bt.simulating');

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass p-5">
      <div className="relative flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-glow-cyan" />
          {label} <span className="font-mono text-glow-cyan">{progress.symbol}</span>
        </span>
        <span className="num text-slate-400">{percent}%</span>
      </div>

      <div dir="ltr" className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-glow-cyan via-glow-blue to-glow-violet"
          animate={{ width: `${Math.max(3, percent)}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
        />
        <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)] bg-[length:200%_100%]" />
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}
      </div>
    </motion.div>
  );
};

export default ProgressCard;

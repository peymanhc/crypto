import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
import { BacktestResult } from '../../types/backtest';
import { formatDay, formatSignedPct } from '../../lib/format';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

type Tone = 'good' | 'warn' | 'bad';

// One-line judgement of the run, from profit factor and expectancy
const verdictFor = (result: BacktestResult): { tone: Tone; text: TranslationKey } => {
  const { profitFactor, expectancyPct } = result.stats;
  if (profitFactor >= 1.5 && expectancyPct > 0) return { tone: 'good', text: 'bt.verdict.good' };
  if (profitFactor >= 1 && expectancyPct > 0) return { tone: 'warn', text: 'bt.verdict.warn' };
  return { tone: 'bad', text: 'bt.verdict.bad' };
};

const toneStyles: Record<Tone, { box: string; icon: string; Icon: typeof TrendingUp }> = {
  good: { box: 'border-long/30 bg-long/10', icon: 'bg-long/20 text-long', Icon: TrendingUp },
  warn: { box: 'border-glow-amber/30 bg-glow-amber/10', icon: 'bg-glow-amber/20 text-glow-amber', Icon: ShieldAlert },
  bad: { box: 'border-short/30 bg-short/10', icon: 'bg-short/20 text-short', Icon: TrendingDown },
};

const VerdictBanner: React.FC<{ result: BacktestResult }> = ({ result }) => {
  const { t, ttf } = useI18n();
  const { stats, config } = result;
  const { tone, text } = verdictFor(result);
  const style = toneStyles[tone];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${style.box}`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${style.icon}`}>
          <style.Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-base font-semibold text-white">{t(text)}</p>
          <p className="text-xs text-slate-400">
            <span className="font-mono">{config.symbols.join(', ')}</span> · {ttf(config.timeframe)} · {formatDay(stats.from)} → {formatDay(stats.to)}
          </p>
        </div>
      </div>
      <p className={`num font-display text-2xl font-semibold ${stats.totalReturnPct >= 0 ? 'text-long' : 'text-short'}`}>
        {formatSignedPct(stats.totalReturnPct)}
      </p>
    </motion.div>
  );
};

export default VerdictBanner;

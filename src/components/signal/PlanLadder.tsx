import { motion } from 'framer-motion';
import { TradePlan } from '../../types/trading';
import { formatPrice } from '../../lib/format';
import { useI18n } from '../../i18n';

type Tone = 'stop' | 'entry' | 'target';

const toneClass: Record<Tone, string> = {
  stop: 'bg-short/[0.07] text-short',
  entry: 'border border-glow-cyan/30 bg-glow-cyan/10 text-white',
  target: 'bg-long/[0.07] text-long',
};

// Price levels of a plan stacked top to bottom: highest price first, so a long
// reads TPs -> entry -> SL and a short reads SL -> entry -> TPs
const PlanLadder: React.FC<{ plan: TradePlan }> = ({ plan }) => {
  const { t } = useI18n();
  const levels: { label: string; value: number; tone: Tone }[] = [
    { label: 'SL', value: plan.stopLoss, tone: 'stop' },
    { label: t('signal.entry'), value: plan.entry, tone: 'entry' },
    ...plan.takeProfits.map((tp, i) => ({ label: `TP${i + 1}`, value: tp, tone: 'target' as Tone })),
  ];
  const topToBottom = plan.direction === 'Long' ? [...levels].reverse() : levels;

  return (
    <div className="grid grid-cols-1 gap-1">
      {topToBottom.map((level, index) => (
        <motion.div
          key={level.label}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + index * 0.05 }}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] ${toneClass[level.tone]}`}
        >
          <span className="font-semibold">{level.label}</span>
          <span className="num">{formatPrice(level.value)}</span>
        </motion.div>
      ))}
    </div>
  );
};

export default PlanLadder;

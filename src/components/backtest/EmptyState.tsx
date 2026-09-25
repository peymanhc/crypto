import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { useI18n } from '../../i18n';

// Shown before the first run
const EmptyState = () => {
  const { t } = useI18n();
  return (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
    <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-glow-cyan/20 to-glow-violet/20 text-glow-cyan animate-float">
      <FlaskConical className="h-7 w-7" />
    </span>
    <p className="font-display text-lg font-semibold text-white">{t('bt.empty.title')}</p>
    <p className="max-w-sm text-sm text-slate-400">{t('bt.empty.text')}</p>
  </motion.div>
  );
};

export default EmptyState;

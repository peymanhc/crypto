import { motion } from 'framer-motion';
import { PresetStrategy } from '../../types/strategy';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

interface PresetCardProps {
  preset: PresetStrategy;
  enabled: boolean;
  index: number;
  onToggle: () => void;
}

// One ready-made strategy with its description, its rules and an on/off switch
const PresetCard: React.FC<PresetCardProps> = ({ preset, enabled, index, onToggle }) => {
  const { t } = useI18n();
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass glass-hover w-full p-4 text-start ${enabled ? '!border-long/40' : ''}`}
    >
      <span className="relative flex items-start justify-between gap-3">
        <span>
          <span className="block font-display text-sm font-semibold text-white">{t(`preset.${preset.id}` as TranslationKey)}</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">{t(`preset.${preset.id}.desc` as TranslationKey)}</span>
        </span>
        <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
          <span className={`absolute inset-0 rounded-full transition-colors ${enabled ? 'bg-long/70' : 'bg-white/10'}`} />
          <span className={`absolute start-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5 rtl:-translate-x-5' : ''}`} />
        </span>
      </span>
      <span className="relative mt-2.5 flex flex-wrap gap-1">
        {preset.rules.map((rule) => (
          <span key={rule.id} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-400">
            {t(`rule.${rule.type}` as TranslationKey)}
          </span>
        ))}
        <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-500">
          {t('builder.minScore')}: {preset.minScore}
        </span>
      </span>
    </motion.button>
  );
};

export default PresetCard;

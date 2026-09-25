import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { BacktestConfig } from '../../types/backtest';
import Field from '../ui/Field';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

interface CostsFieldsProps {
  config: BacktestConfig;
  disabled?: boolean;
  onChange: <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => void;
}

interface NumberFieldSpec {
  key: 'feePct' | 'slippagePct' | 'sizePct' | 'startEquity' | 'maxHoldHours';
  label: TranslationKey;
  min: number;
  max: number;
  step: number;
}

const FIELDS: NumberFieldSpec[] = [
  { key: 'feePct', label: 'bt.fee', min: 0, max: 1, step: 0.01 },
  { key: 'slippagePct', label: 'bt.slippage', min: 0, max: 1, step: 0.01 },
  { key: 'sizePct', label: 'bt.margin', min: 1, max: 100, step: 1 },
  { key: 'startEquity', label: 'bt.startEquity', min: 1, max: 1_000_000, step: 100 },
  { key: 'maxHoldHours', label: 'bt.maxHold', min: 1, max: 720, step: 1 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Collapsible "Costs & sizing" section: fees, slippage, margin, start equity, max hold
const CostsFields: React.FC<CostsFieldsProps> = ({ config, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-200"
      >
        {t('bt.costs')}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-2 gap-2 pb-1">
              {FIELDS.map((field) => (
                <Field key={field.key} label={t(field.label)}>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={config[field.key]}
                    disabled={disabled}
                    onChange={(e) => onChange(field.key, clamp(Number(e.target.value) || field.min, field.min, field.max))}
                    className="field !py-1.5 text-xs"
                  />
                </Field>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500">{t('bt.costsHint')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CostsFields;
